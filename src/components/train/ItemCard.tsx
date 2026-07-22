// Карточка одного упражнения в тренировке: чипы параметров, заметки тренера,
// «прошлый раз», отметка «выполнено» и лёгкий редактор (комментарий + факт).

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { exerciseKind, type Actual, type ActualSet, type Exercise, type WorkoutItem } from '../../types';
import type { Occurrence } from '../../store';
import { useT, type Dict } from '../../i18n';
import { fmtDateShort } from '../../lib/dates';
import { perSetSummary } from '../../lib/actual';
import { IconPlus } from '../edit/ui';
import VideoLink from './VideoLink';
import {
  BarbellIcon,
  CheckIcon,
  ChevronIcon,
  ClockIcon,
  CommentIcon,
  FlameIcon,
  HeartPulseIcon,
  HistoryIcon,
  PinIcon,
  RepeatIcon,
  SidesIcon,
  SkullIcon,
  TempoIcon,
  VideoIcon,
  XIcon,
} from './icons';

interface ItemCardProps {
  item: WorkoutItem;
  /** Порядковый номер в тренировке (1..n) */
  num: number;
  exercise: Exercise | undefined;
  last: Occurrence | null;
  /** Тренировка завершена и закрыта: отметки «выполнено» не переключаются */
  locked: boolean;
  /** Иммутабельный патч позиции — экран сам подменит её в workout и сохранит */
  onChange: (patch: Partial<WorkoutItem>) => void;
  onRest: (item: WorkoutItem) => void;
}

/** «1. Румынская» / «1.Румынская» / «2) Присед» → без нумерации */
function stripNumbering(raw: string): string {
  const s = raw.replace(/^\s*\d+(?:\.\d+)*\s*[.)]\s*/, '').trim();
  return s || raw.trim();
}

/** Для чипа: «1.5» → «1.5 мин» / "1.5 min", а «2 мин» / свободный текст — как есть */
function restLabel(rest: string, dict: Dict): string {
  const t = rest.trim();
  return /^[\d.,\s\-–—+]+$/.test(t) ? `${t} ${dict.min}` : t;
}

/** Для чипа: «27.5» → «27.5 кг» / "27.5 kg", а «12+12 кг» / свободный текст — как есть */
function weightLabel(weight: string, dict: Dict): string {
  const t = weight.trim();
  return /^[\d.,\s\-–—+]+$/.test(t) ? `${t} ${dict.kg}` : t;
}

/** Короткая строка «что было в прошлый раз» */
function lastSummary(it: WorkoutItem, dict: Dict): string {
  let core = '';
  if (it.actual) {
    core = actualParts(it.actual, dict).join(' × ');
    const txt = (it.actual.text ?? '').trim();
    if (txt) core = core ? `${core}, ${txt}` : txt;
  }
  if (!core) {
    const parts: string[] = [];
    if (it.duration) parts.push(restLabel(it.duration, dict)); // кардио
    if (it.setsReps?.raw) parts.push(it.setsReps.raw);
    if (it.weight?.raw) parts.push(`${dict.item.weightPrefix} ${it.weight.raw}`);
    core = parts.join(', ');
  }
  const comment = (it.myComment ?? '').trim().replace(/\s+/g, ' ');
  if (comment) core = core ? `${core} · ${comment}` : comment;
  return core || dict.item.noRecord;
}

/** Части сводки факта: при «разных подходах» — «20-18-16 кг», «3×12-10-8» */
function actualParts(a: Actual, dict: Dict): string[] {
  const ps = perSetSummary(a);
  const parts: string[] = [];
  if (ps?.weights) parts.push(`${ps.weights} ${dict.kg}`);
  else if (a.weight != null) parts.push(`${a.weight} ${dict.kg}`);
  if (ps?.reps) parts.push(`${ps.count}×${ps.reps}`);
  else if (a.sets != null && a.reps != null) parts.push(`${a.sets}×${a.reps}`);
  else if (a.sets != null) parts.push(dict.item.setsShort(a.sets));
  else if (a.reps != null) parts.push(dict.item.repsShort(a.reps));
  return parts;
}

export default function ItemCard({
  item,
  num,
  exercise,
  last,
  locked,
  onChange,
  onRest,
}: ItemCardProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // «чпок» галочки только на живой тап, не при монтировании карточки
  const [checkPop, setCheckPop] = useState(false);
  /* Быстрая запись факта: долгое нажатие на чипы повторов/веса превращает
     их в компактный редактор прямо на месте — без большой панели */
  const [quickEdit, setQuickEdit] = useState(false);
  const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  const pressFiredRef = useRef(false);

  // Замок завершённой тренировки закрывает и запись факта: открытый
  // редактор сворачивается (например, «Завершить» нажали при открытом)
  useEffect(() => {
    if (locked) setQuickEdit(false);
  }, [locked]);

  const kind = exerciseKind(exercise);
  const name = t.catalog.exercise(exercise?.name ?? stripNumbering(item.nameRaw ?? ''));
  const videoUrl = item.videoUrl ?? exercise?.videoUrl ?? null;
  const myComment = (item.myComment ?? '').trim();

  /* Чипы параметров: вместо словесных подписей — иконки (слова остаются
     для скринридера и в title при долгом тапе); «темп» оставлен словом.
     Записанный факт вытесняет план: показываем одно число, не оба.
     «Разные подходы» показываются в нотации тренера: «3х12-10-8». */
  const ps = perSetSummary(item.actual);
  const factSets = item.actual?.sets ?? null;
  const factReps = item.actual?.reps ?? null;
  const setsRepsText = ps?.reps
    ? `${ps.count}х${ps.reps}`
    : factSets != null && factReps != null
      ? `${factSets}х${factReps}`
      : (item.setsReps?.raw ?? '');
  const weightText = ps?.weights
    ? weightLabel(ps.weights, t)
    : item.actual?.weight != null
      ? weightLabel(String(item.actual.weight), t)
      : item.weight?.raw
        ? weightLabel(item.weight.raw, t)
        : '';

  /* Свёрнутая карточка показывает только главное — повторы, вес и отдых;
     ПВР и темп уезжают в раскрытую часть. bold — жирные цифры-факты.
     У кардио свои чипы: длительность и пульсовая зона. */
  const mainChips: { icon: ReactNode | null; name: string | null; text: string; bold: boolean }[] =
    [];
  if (kind === 'cardio') {
    if (item.duration)
      mainChips.push({
        icon: <ClockIcon size={16} />,
        name: t.item.chipDuration,
        text: restLabel(item.duration, t),
        bold: true,
      });
    if (item.pulseZone)
      mainChips.push({
        icon: <HeartPulseIcon />,
        name: t.item.chipPulse,
        text: item.pulseZone,
        bold: true,
      });
  }
  if (setsRepsText)
    mainChips.push({
      icon: <RepeatIcon />,
      name: t.item.chipSetsReps,
      text: setsRepsText,
      bold: true,
    });
  if (weightText)
    mainChips.push({ icon: <BarbellIcon />, name: t.item.chipWeight, text: weightText, bold: true });
  // подсказка «3х12 — это на каждую сторону», без выделения жирным
  if (kind === 'main' && exercise?.unilateral)
    mainChips.push({
      icon: <SidesIcon />,
      name: null,
      text: t.item.chipEachSide,
      bold: false,
    });
  const detailChips: typeof mainChips = [];
  if (item.pvr)
    detailChips.push({
      icon: <SkullIcon />,
      name: t.item.chipPvrName,
      text: t.item.pvr(item.pvr),
      bold: true,
    });
  if (item.tempo)
    detailChips.push({ icon: <TempoIcon />, name: t.item.chipTempo, text: item.tempo, bold: false });

  // Тап по карточке раскрывает её, но не когда попали в ссылку/кнопку/поле
  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    // клик, «дозвучавший» после долгого нажатия, — не тап
    if (pressFiredRef.current) {
      pressFiredRef.current = false;
      return;
    }
    const el = e.target as HTMLElement;
    if (el.closest('a,button,input,textarea,select,label')) return;
    setOpen((v) => !v);
  };

  /* Долгое нажатие (450 мс) на строке чипов; сдвиг пальца > 12px — скролл,
     не нажатие. Кнопки в строке (отдых) жест не перехватывают. */
  const cancelPress = () => {
    if (pressRef.current) {
      window.clearTimeout(pressRef.current.timer);
      pressRef.current = null;
    }
  };
  const startPress = (e: React.PointerEvent) => {
    if (kind === 'cardio' || quickEdit || locked) return;
    if ((e.target as HTMLElement).closest('button,a,input')) return;
    cancelPress();
    pressRef.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        pressRef.current = null;
        pressFiredRef.current = true;
        setQuickEdit(true);
      }, 450),
    };
  };
  const movePress = (e: React.PointerEvent) => {
    const p = pressRef.current;
    if (p && (Math.abs(e.clientX - p.x) > 12 || Math.abs(e.clientY - p.y) > 12)) cancelPress();
  };

  return (
    <div
      onClick={handleCardClick}
      className="cursor-pointer rounded-2xl border border-border bg-card p-4"
    >
      {/* Номер + название + видео техники + отметка «выполнено» */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={
            'mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-lg px-1 text-[13px] font-bold tabular-nums ' +
            (item.done ? 'bg-bg text-muted' : 'bg-chip text-muted')
          }
        >
          {num}
        </span>
        <h3
          className={
            'min-w-0 flex-1 break-words text-xl font-bold leading-snug ' +
            (item.done ? 'text-muted' : '')
          }
        >
          <span className="sr-only">{num}. </span>
          {name || t.item.fallbackName}
        </h3>
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={t.item.techVideo}
            title={t.item.techVideo}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <VideoIcon />
          </a>
        )}
        <button
          onClick={() => {
            onChange({ done: !item.done });
            // «чпок» — только при отметке; снятие отметки происходит без праздника
            if (!item.done) setCheckPop(true);
          }}
          onAnimationEnd={() => setCheckPop(false)}
          disabled={locked}
          aria-pressed={item.done}
          aria-label={item.done ? t.item.unmarkDone : t.item.markDone}
          title={locked ? t.train.lockedHint : undefined}
          className={
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ' +
            (item.done
              ? 'border-ok bg-ok text-ok-fg'
              : 'border-border bg-card text-muted') +
            (checkPop ? ' anim-check' : '')
          }
        >
          <CheckIcon />
        </button>
      </div>

      <div className={item.done ? 'opacity-70' : ''}>
        {/* Разминка упражнения — первой: с неё начинают и её читают первой */}
        {item.warmupSets && (
          <p title={t.item.warmupSr} className="mt-2.5 flex items-start gap-1.5 text-xs">
            <span className="mt-0.5 shrink-0 text-muted">
              <FlameIcon size={14} />
            </span>
            <span className="sr-only">{t.item.warmupSr}: </span>
            <span className="min-w-0 whitespace-pre-line break-words text-muted">
              {item.warmupSets}
            </span>
          </p>
        )}

        {/* Строка данных: повторы × вес + отдых; справа — значки
            «есть комментарий» / «есть заметка тренера» и шеврон раскрытия.
            Долгое нажатие на чипы включает быструю запись факта на месте. */}
        {quickEdit ? (
          <QuickFact item={item} onChange={onChange} onClose={() => setQuickEdit(false)} />
        ) : (
          <div
            onPointerDown={startPress}
            onPointerMove={movePress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => {
              // долгое нажатие на Android открывает контекстное меню — глушим
              if (kind !== 'cardio') e.preventDefault();
            }}
            className="mt-2.5 flex select-none flex-wrap items-center gap-1.5 [-webkit-touch-callout:none]"
          >
            {mainChips.map((c, i) => (
              <span
                key={i}
                title={c.name ?? undefined}
                className={
                  'inline-flex max-w-full items-center gap-1 rounded-lg bg-chip px-2 py-1 text-sm tabular-nums ' +
                  (c.bold ? 'font-bold' : 'font-medium')
                }
              >
                {c.icon && <span className="shrink-0 text-muted">{c.icon}</span>}
                {c.name && <span className="sr-only">{c.name}: </span>}
                <span className="min-w-0 break-words">{c.text}</span>
              </span>
            ))}
            {item.rest && (
              <button
                onClick={() => onRest(item)}
                aria-label={t.item.startRest}
                title={t.item.rest}
                className="relative inline-flex max-w-full items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-left text-sm font-bold text-accent underline decoration-dotted underline-offset-2 after:absolute after:-inset-1.5 after:content-['']"
              >
                <span className="sr-only">{t.item.rest}: </span>
                <span className="min-w-0 break-words">{restLabel(item.rest, t)}</span>
              </button>
            )}
            <span className="ml-auto flex items-center gap-1 text-muted">
              {myComment && (
                <span title={t.item.hasMyComment} className="flex h-8 w-6 items-center justify-center">
                  <CommentIcon />
                  <span className="sr-only">{t.item.hasMyComment}</span>
                </span>
              )}
              {(item.ptNote || item.ptRequest) && (
                <span title={t.item.hasPtNote} className="flex h-8 w-6 items-center justify-center">
                  <PinIcon />
                  <span className="sr-only">{t.item.hasPtNote}</span>
                </span>
              )}
              <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? t.item.collapse : t.item.expand}
                className="relative -my-1 flex h-9 w-9 items-center justify-center rounded-lg after:absolute after:-inset-1 after:content-['']"
              >
                <ChevronIcon open={open} />
              </button>
            </span>
          </div>
        )}

      </div>

      {/* Раскрытая часть всегда в DOM: высота плавно едет классом .expander
          в обе стороны, закрытое содержимое недоступно для фокуса (inert) */}
      <div className={'expander' + (open ? ' expander-open' : '')} inert={!open}>
        <div>
          <div className={item.done ? 'opacity-70' : ''}>
            {detailChips.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {detailChips.map((c, i) => (
                  <span
                    key={i}
                    title={c.name ?? undefined}
                    className={
                      'inline-flex max-w-full items-center gap-1 rounded-lg bg-chip px-2 py-1 text-sm tabular-nums ' +
                      (c.bold ? 'font-bold' : 'font-medium')
                    }
                  >
                    {c.icon && <span className="shrink-0 text-muted">{c.icon}</span>}
                    {c.name && <span className="sr-only">{c.name}: </span>}
                    <span className="min-w-0 break-words">{c.text}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Техника: подсказки-подпункты */}
            {item.subNotes.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {item.subNotes.map((sn, i) => (
                  <li key={i} className="break-words text-sm leading-snug text-muted">
                    {sn.text}
                    {sn.videoUrl && <VideoLink href={sn.videoUrl} className="ml-1.5" />}
                  </li>
                ))}
              </ul>
            )}

            {/* Примечание тренера — с булавкой; строки с 📌 — просьбы
                на этот день, они выделены жирнее */}
            {(item.ptNote || item.ptRequest) && (
              <div className="mt-2.5 flex items-start gap-1.5 text-sm">
                <span className="mt-0.5 shrink-0 text-muted">
                  <PinIcon />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  {(item.ptNote ?? '')
                    .split('\n')
                    .map((line, i) => {
                      const t = line.trim();
                      if (!t) return null;
                      const pinned = t.startsWith('📌');
                      return (
                        <p key={i} className={'break-words ' + (pinned ? 'font-semibold' : 'text-muted')}>
                          {t.replace(/^📌\s*/, '')}
                        </p>
                      );
                    })}
                  {/* совместимость со старыми данными, где запрос лежал отдельным полем */}
                  {item.ptRequest && (
                    <p className="whitespace-pre-line break-words font-semibold">{item.ptRequest}</p>
                  )}
                </div>
              </div>
            )}

            {/* Прошлый раз — рядом с местом записи, чтобы сверяться */}
            {last && (
              <p title={t.item.lastTime} className="mt-2.5 flex items-start gap-1.5 text-xs text-muted">
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                  <HistoryIcon />
                </span>
                <span className="sr-only">{t.item.lastTime}, </span>
                <span className="min-w-0 flex-1">
                  {fmtDateShort(last.workout.date)}: {lastSummary(last.item, t)}
                </span>
              </p>
            )}

            {/* Дублирующий вход в быструю запись: для упражнений без чипов
                (нет плана) и для тех, кто не знает про долгое нажатие */}
            {kind !== 'cardio' && !quickEdit && !locked && (
              <button
                type="button"
                onClick={() => setQuickEdit(true)}
                className="mt-2.5 text-sm text-muted underline decoration-dotted underline-offset-2"
              >
                {t.item.logFact}
              </button>
            )}
          </div>
          <CommentEditor item={item} open={open} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

/* --- Лёгкий редактор: комментарий + быстрый лог факта ------------------- */

function numToStr(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

/* --- Комментарий-фидбэк (раскрытая часть): факт живёт у чипов ------------ */

function CommentEditor({
  item,
  open,
  onChange,
}: {
  item: WorkoutItem;
  /** Карточка раскрыта: редактор постоянно смонтирован ради анимации высоты */
  open: boolean;
  onChange: (patch: Partial<WorkoutItem>) => void;
}) {
  const { t } = useT();
  const [comment, setComment] = useState(item.myComment ?? '');
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  /* Редактор не размонтируется при закрытии карточки, поэтому при каждом
     раскрытии (и смене записи) подтягиваем свежее значение */
  useEffect(() => {
    if (!open) return;
    setComment(item.myComment ?? '');
  }, [open, item]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    },
    [],
  );

  const commitComment = () => {
    if (comment === (item.myComment ?? '')) return;
    onChange({ myComment: comment });
    setSaved(true);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="anim-rise mt-4 border-t border-border pt-4" onClick={(e) => e.stopPropagation()}>
      <label className="block">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-bold uppercase tracking-wider text-muted">
            {t.item.yourComment}
          </span>
          <span
            aria-live="polite"
            className={
              'text-xs font-medium text-ok-text transition-opacity duration-300 ' +
              (saved ? 'opacity-100' : 'opacity-0')
            }
          >
            {t.item.savedFlash}
          </span>
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={commitComment}
          rows={2}
          placeholder={t.item.howWasIt}
          className="mt-1 w-full resize-y rounded-xl border border-border bg-chip px-3 py-2.5 text-base outline-none focus:border-accent"
        />
      </label>

      {(item.actual?.text ?? '').trim() !== '' && (
        <p className="mt-2 text-xs text-muted">{t.item.oldFactNote(item.actual?.text ?? '')}</p>
      )}
    </div>
  );
}

/* --- Быстрая запись факта на месте чипов --------------------------------- */
/* Компактный редактор: одно число (вес × подходы × повторы) или «разные
   подходы» — строка на подход. Сохранение по blur, галочка закрывает. */

function QuickFact({
  item,
  onChange,
  onClose,
}: {
  item: WorkoutItem;
  onChange: (patch: Partial<WorkoutItem>) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<'single' | 'perSet'>(
    item.actual?.perSet?.length ? 'perSet' : 'single',
  );
  const [wStr, setWStr] = useState(numToStr(item.actual?.weight ?? item.weight?.value));
  const [sStr, setSStr] = useState(numToStr(item.actual?.sets ?? item.setsReps?.sets));
  const [rStr, setRStr] = useState(numToStr(item.actual?.reps ?? item.setsReps?.reps));
  const [rows, setRows] = useState<{ w: string; r: string }[]>(() =>
    (item.actual?.perSet ?? []).map((s) => ({ w: numToStr(s.weight), r: numToStr(s.reps) })),
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    },
    [],
  );

  const flashSaved = () => {
    setSaved(true);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSaved(false), 1800);
  };

  // Сохраняем факт только если поля реально трогали — иначе не выдумываем actual.
  // Старый свободный текст записи (actual.text) бережно переносим как есть.
  const commitSingle = () => {
    if (!dirty) return;
    const weight = parseNum(wStr);
    const sets = parseIntOrNull(sStr);
    const reps = parseIntOrNull(rStr);
    const text = (item.actual?.text ?? '').trim();
    const actual: Actual | null =
      weight == null && sets == null && reps == null && text === ''
        ? null
        : { weight, sets, reps, text };
    onChange({ actual });
    setDirty(false);
    flashSaved();
  };

  /** Сохранить строки подходов; агрегаты выводятся из них (вес = максимум) */
  const commitRows = (rs: { w: string; r: string }[]) => {
    const clean: ActualSet[] = rs
      .map((x) => ({ weight: parseNum(x.w), reps: parseIntOrNull(x.r) }))
      .filter((s) => s.weight != null || s.reps != null);
    const text = (item.actual?.text ?? '').trim();
    if (clean.length === 0) {
      onChange({ actual: text === '' ? null : { weight: null, sets: null, reps: null, text } });
    } else {
      const weights = clean.map((s) => s.weight).filter((x): x is number => x != null);
      const reps = clean.map((s) => s.reps);
      const sameReps =
        reps.every((x) => x != null) && new Set(reps as number[]).size === 1
          ? (reps[0] as number)
          : null;
      onChange({
        actual: {
          weight: weights.length ? Math.max(...weights) : null,
          sets: clean.length,
          reps: sameReps,
          text,
          perSet: clean,
        },
      });
    }
    setDirty(false);
    flashSaved();
  };

  const commitRowsIfDirty = () => {
    if (dirty) commitRows(rows);
  };

  const patchRow = (i: number, p: Partial<{ w: string; r: string }>) => {
    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, ...p } : x)));
    setDirty(true);
  };

  const addRow = () => {
    // новый подход повторяет предыдущий — обычно меняется одно число
    const last = rows[rows.length - 1];
    const next = [...rows, { w: last?.w ?? wStr, r: last?.r ?? rStr }];
    setRows(next);
    commitRows(next);
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    setRows(next);
    commitRows(next);
  };

  const enablePerSet = () => {
    // подходы берём из записи, из плана «разными подходами» или повторяем
    // видимые числа столько раз, сколько в поле «подходы»
    const fromActual = item.actual?.perSet?.map((s) => ({
      w: numToStr(s.weight),
      r: numToStr(s.reps),
    }));
    const fromPlan = item.perSetPlan?.map((p) => ({
      w: numToStr(parseNum(p.weight)),
      r: numToStr(parseIntOrNull(p.reps)),
    }));
    const n = Math.min(10, Math.max(1, parseIntOrNull(sStr) ?? 3));
    const next =
      fromActual?.length
        ? fromActual
        : fromPlan?.length
          ? fromPlan
          : Array.from({ length: n }, () => ({ w: wStr, r: rStr }));
    setRows(next);
    setMode('perSet');
    commitRows(next);
  };

  const disablePerSet = () => {
    setMode('single');
    setDirty(false);
    if (item.actual?.perSet) {
      // агрегаты уже посчитаны при сохранении подходов — убираем детализацию
      const { perSet: _drop, ...rest } = item.actual;
      onChange({ actual: rest });
      setWStr(numToStr(rest.weight));
      setSStr(numToStr(rest.sets));
      setRStr(numToStr(rest.reps));
      flashSaved();
    }
  };

  const inputCls =
    'h-10 w-full rounded-lg border border-border bg-chip px-2 text-center text-base font-semibold tabular-nums outline-none focus:border-accent';

  return (
    <div
      role="group"
      aria-label={t.item.quickFactAria}
      onClick={(e) => e.stopPropagation()}
      className="anim-rise mt-2.5 rounded-xl border border-accent/50 bg-bg p-2"
    >
      {mode === 'single' ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="number"
            step={0.5}
            inputMode="decimal"
            value={wStr}
            aria-label={t.item.weightKg}
            onChange={(e) => {
              setWStr(e.target.value);
              setDirty(true);
            }}
            onBlur={commitSingle}
            className={inputCls + ' max-w-20'}
          />
          <span className="shrink-0 text-sm text-muted">{t.kg}</span>
          <input
            type="number"
            step={1}
            min={0}
            inputMode="numeric"
            value={sStr}
            aria-label={t.item.sets}
            onChange={(e) => {
              setSStr(e.target.value);
              setDirty(true);
            }}
            onBlur={commitSingle}
            className={inputCls + ' max-w-12'}
          />
          <span className="shrink-0 text-sm text-muted">х</span>
          <input
            type="number"
            step={1}
            min={0}
            inputMode="numeric"
            value={rStr}
            aria-label={t.item.reps}
            onChange={(e) => {
              setRStr(e.target.value);
              setDirty(true);
            }}
            onBlur={commitSingle}
            className={inputCls + ' max-w-14'}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.1rem_1fr_0.9rem_1fr_2rem] items-center gap-1.5"
            >
              <span className="text-center text-sm font-semibold tabular-nums text-muted">
                {i + 1}
              </span>
              <input
                type="number"
                step={0.5}
                inputMode="decimal"
                value={row.w}
                aria-label={t.item.perSetWeightAria(i + 1)}
                onChange={(e) => patchRow(i, { w: e.target.value })}
                onBlur={commitRowsIfDirty}
                className={inputCls}
              />
              <span className="text-center text-sm text-muted">х</span>
              <input
                type="number"
                step={1}
                min={0}
                inputMode="numeric"
                value={row.r}
                aria-label={t.item.perSetRepsAria(i + 1)}
                onChange={(e) => patchRow(i, { r: e.target.value })}
                onBlur={commitRowsIfDirty}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                aria-label={t.item.removeSetAria(i + 1)}
                title={t.item.removeSetAria(i + 1)}
                className="flex h-9 w-8 items-center justify-center rounded-lg text-muted disabled:opacity-35"
              >
                <XIcon size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg py-1 pr-2 text-sm font-medium text-accent"
          >
            <IconPlus size={14} /> {t.item.addSet}
          </button>
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={mode === 'perSet' ? disablePerSet : enablePerSet}
          className="text-sm text-muted underline decoration-dotted underline-offset-2"
        >
          {mode === 'perSet' ? t.item.perSetOff : t.item.perSetOn}
        </button>
        <span
          aria-live="polite"
          className={
            'ml-auto text-xs font-medium text-ok-text transition-opacity duration-300 ' +
            (saved ? 'opacity-100' : 'opacity-0')
          }
        >
          {t.item.savedFlash}
        </span>
        <button
          type="button"
          onClick={() => {
            if (mode === 'perSet') commitRowsIfDirty();
            else commitSingle();
            onClose();
          }}
          aria-label={t.item.doneEditing}
          title={t.item.doneEditing}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg"
        >
          <CheckIcon size={16} />
        </button>
      </div>
    </div>
  );
}
