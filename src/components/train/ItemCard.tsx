// Карточка одного упражнения в тренировке: чипы параметров, заметки тренера,
// «прошлый раз», отметка «выполнено» и лёгкий редактор (комментарий + факт).

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { exerciseKind, type Actual, type Exercise, type WorkoutItem } from '../../types';
import type { Occurrence } from '../../store';
import { useT, type Dict } from '../../i18n';
import { fmtDateShort } from '../../lib/dates';
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
    const parts: string[] = [];
    if (it.actual.weight != null) parts.push(`${it.actual.weight} ${dict.kg}`);
    if (it.actual.sets != null && it.actual.reps != null)
      parts.push(`${it.actual.sets}×${it.actual.reps}`);
    else if (it.actual.sets != null) parts.push(dict.item.setsShort(it.actual.sets));
    else if (it.actual.reps != null) parts.push(dict.item.repsShort(it.actual.reps));
    core = parts.join(' × ');
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

  const kind = exerciseKind(exercise);
  const name = t.catalog.exercise(exercise?.name ?? stripNumbering(item.nameRaw ?? ''));
  const videoUrl = item.videoUrl ?? exercise?.videoUrl ?? null;
  const myComment = (item.myComment ?? '').trim();

  /* Чипы параметров: вместо словесных подписей — иконки (слова остаются
     для скринридера и в title при долгом тапе); «темп» оставлен словом.
     Записанный факт вытесняет план: показываем одно число, не оба. */
  const factSets = item.actual?.sets ?? null;
  const factReps = item.actual?.reps ?? null;
  const setsRepsText =
    factSets != null && factReps != null ? `${factSets}х${factReps}` : (item.setsReps?.raw ?? '');
  const weightText =
    item.actual?.weight != null
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
    const el = e.target as HTMLElement;
    if (el.closest('a,button,input,textarea,select,label')) return;
    setOpen((v) => !v);
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
            «есть комментарий» / «есть заметка тренера» и шеврон раскрытия */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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

            {/* Прошлый раз — над полями «Факт», чтобы сверяться при записи */}
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
          </div>
          <ItemEditor item={item} open={open} cardio={kind === 'cardio'} onChange={onChange} />
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

function ItemEditor({
  item,
  open,
  cardio,
  onChange,
}: {
  item: WorkoutItem;
  /** Карточка раскрыта: редактор постоянно смонтирован ради анимации высоты */
  open: boolean;
  /** Кардио: только комментарий-фидбэк, без факта вес×подходы×повторы */
  cardio: boolean;
  onChange: (patch: Partial<WorkoutItem>) => void;
}) {
  const { t } = useT();
  const [comment, setComment] = useState(item.myComment ?? '');
  const [wStr, setWStr] = useState(numToStr(item.actual?.weight ?? item.weight?.value));
  const [sStr, setSStr] = useState(numToStr(item.actual?.sets ?? item.setsReps?.sets));
  const [rStr, setRStr] = useState(numToStr(item.actual?.reps ?? item.setsReps?.reps));
  const [factDirty, setFactDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  /* Редактор больше не размонтируется при закрытии карточки, поэтому
     при каждом раскрытии (и смене записи) подтягиваем свежие значения */
  useEffect(() => {
    if (!open) return;
    setComment(item.myComment ?? '');
    setWStr(numToStr(item.actual?.weight ?? item.weight?.value));
    setSStr(numToStr(item.actual?.sets ?? item.setsReps?.sets));
    setRStr(numToStr(item.actual?.reps ?? item.setsReps?.reps));
    setFactDirty(false);
  }, [open, item]);

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

  const commitComment = () => {
    if (comment === (item.myComment ?? '')) return;
    onChange({ myComment: comment });
    flashSaved();
  };

  // Сохраняем факт только если поля реально трогали — иначе не выдумываем actual.
  // Отдельного поля «заметка к факту» больше нет: старый текст, если он был
  // в записи, бережно переносим как есть.
  const commitFact = () => {
    if (!factDirty) return;
    const weight = parseNum(wStr);
    const sets = parseIntOrNull(sStr);
    const reps = parseIntOrNull(rStr);
    const text = (item.actual?.text ?? '').trim();
    const actual: Actual | null =
      weight == null && sets == null && reps == null && text === ''
        ? null
        : { weight, sets, reps, text };
    onChange({ actual });
    setFactDirty(false);
    flashSaved();
  };

  const fieldCls =
    'mt-1 w-full rounded-xl border border-border bg-chip px-3 py-2.5 text-base outline-none focus:border-accent';

  return (
    <div className="anim-rise mt-4 border-t border-border pt-4" onClick={(e) => e.stopPropagation()}>
      <label className="block">
        <span className="text-[12px] font-bold uppercase tracking-wider text-muted">
          {t.item.yourComment}
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={commitComment}
          rows={2}
          placeholder={t.item.howWasIt}
          className={fieldCls + ' resize-y'}
        />
      </label>

      {!cardio && (
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-bold uppercase tracking-wider text-muted">
            {t.item.fact}
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
        </div>

        <div className="mt-1 grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-muted">{t.item.weightKg}</span>
            <input
              type="number"
              step={0.5}
              inputMode="decimal"
              value={wStr}
              onChange={(e) => {
                setWStr(e.target.value);
                setFactDirty(true);
              }}
              onBlur={commitFact}
              className={fieldCls + ' font-semibold tabular-nums'}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">{t.item.sets}</span>
            <input
              type="number"
              step={1}
              min={0}
              inputMode="numeric"
              value={sStr}
              onChange={(e) => {
                setSStr(e.target.value);
                setFactDirty(true);
              }}
              onBlur={commitFact}
              className={fieldCls + ' font-semibold tabular-nums'}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">{t.item.reps}</span>
            <input
              type="number"
              step={1}
              min={0}
              inputMode="numeric"
              value={rStr}
              onChange={(e) => {
                setRStr(e.target.value);
                setFactDirty(true);
              }}
              onBlur={commitFact}
              className={fieldCls + ' font-semibold tabular-nums'}
            />
          </label>
        </div>

        {(item.actual?.text ?? '').trim() !== '' && (
          <p className="mt-2 text-xs text-muted">{t.item.oldFactNote(item.actual?.text ?? '')}</p>
        )}
      </div>
      )}

      {/* Кардио: «сохранено» живёт у комментария, отдельного факта нет */}
      {cardio && (
        <p
          aria-live="polite"
          className={
            'mt-2 text-right text-xs font-medium text-ok-text transition-opacity duration-300 ' +
            (saved ? 'opacity-100' : 'opacity-0')
          }
        >
          {t.item.savedFlash}
        </p>
      )}
    </div>
  );
}
