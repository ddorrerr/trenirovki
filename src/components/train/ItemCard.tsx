// Карточка одного упражнения в тренировке: чипы параметров, заметки тренера,
// «прошлый раз», отметка «выполнено» и лёгкий редактор (комментарий + факт).

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { exerciseKind, type Actual, type Exercise, type WorkoutItem } from '../../types';
import type { Occurrence } from '../../store';
import { useT, type Dict } from '../../i18n';
import { fmtDateShort } from '../../lib/dates';
import { perSetSummary } from '../../lib/actual';
import { timedSetPlan } from '../../lib/timed-sets';
import { parseRestSeconds } from '../../lib/rest-timer';
import { TimerIcon, fmtClock } from './RestTimer';
import ActionMenu from '../edit/ActionMenu';
import VideoLink from './VideoLink';
import {
  BarbellIcon,
  FlameIcon,
  CheckIcon,
  ChevronIcon,
  ClockIcon,
  HeartPulseIcon,
  HistoryIcon,
  PinIcon,
  RepeatIcon,
  SidesIcon,
  SkullIcon,
  TempoIcon,
  XIcon,
} from './icons';

interface ItemCardProps {
  onEdit?: () => void;
  onMove?: () => void;
  onRemove?: () => void;
  initialOpen?: boolean;
  item: WorkoutItem;
  /** Порядковый номер в тренировке (1..n) */
  num: number;
  exercise: Exercise | undefined;
  last: Occurrence | null;
  /** Тренировка завершена и закрыта: отметки «выполнено» не переключаются */
  locked: boolean;
  /** Режим «идёт»: кружки подходов и ссылка «пропустить сегодня» */
  active?: boolean;
  /** Иммутабельный патч позиции — экран сам подменит её в workout и сохранит */
  onChange: (patch: Partial<WorkoutItem>) => void;
  /** autostart — тихий запуск отсчёта после отмеченного подхода */
  onRest: (item: WorkoutItem, autostart?: boolean) => void;
  onTime?: (item: WorkoutItem) => void;
}

/** «1. Румынская» / «1.Румынская» / «2) Присед» → без нумерации */
export function stripNumbering(raw: string): string {
  const s = raw.replace(/^\s*\d+(?:\.\d+)*\s*[.)]\s*/, '').trim();
  return s || raw.trim();
}

/** Для чипа: «1.5» → «1.5 мин» / "1.5 min", а «2 мин» / свободный текст — как есть */
export function restLabel(rest: string, dict: Dict): string {
  const t = rest.trim();
  return /^[\d.,\s\-–—+]+$/.test(t) ? `${t} ${dict.min}` : t;
}

/** Для чипа: «27.5» → «27.5 кг» / "27.5 kg", а «12+12 кг» / свободный текст — как есть */
export function weightLabel(weight: string, dict: Dict): string {
  const t = weight.trim();
  return /^[\d.,\s\-–—+]+$/.test(t) ? `${t} ${dict.kg}` : t;
}

/** Сколько кружков подходов рисовать: план «разными подходами» или «3х…» */
export function plannedSetsCount(item: WorkoutItem): number {
  const n = timedSetPlan(item)?.length ?? item.perSetPlan?.length ?? item.setsReps?.sets ?? 0;
  return Math.max(0, Math.min(8, n));
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
  active = false,
  initialOpen = false,
  onEdit,
  onMove,
  onRemove,
  onChange,
  onRest,
  onTime,
}: ItemCardProps) {
  const { t } = useT();
  const [open, setOpen] = useState(initialOpen);
  // «чпок» галочки только на живой тап, не при монтировании карточки
  const [checkPop, setCheckPop] = useState(false);
  /* Кружки подходов: последний тап заполняется локально и мгновенно, а
     «выполнено» сохраняется с паузой — видно, как заполнился последний кружок */
  const [pendingFill, setPendingFill] = useState<number | null>(null);
  const [popIdx, setPopIdx] = useState<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (completeTimerRef.current) window.clearTimeout(completeTimerRef.current);
    },
    [],
  );

  // сохранённые отметки пришли из данных — локальная «дозаливка» больше не нужна
  useEffect(() => {
    setPendingFill(null);
  }, [item.setsDone, item.done]);

  const plannedSets = active && exerciseKind(exercise) !== 'cardio' ? plannedSetsCount(item) : 0;
  const setsDone = Math.min(item.setsDone ?? 0, plannedSets);
  const timedPlan = timedSetPlan(item);
  const nextSeconds = timedPlan?.[item.setsDone ?? 0];

  const tapBubble = (idx: number) => {
    if (idx < setsDone) {
      // тап по заполненному — снятие отметок сверху вниз до него
      onChange({ setsDone: idx });
      return;
    }
    const next = idx + 1;
    setPopIdx(idx);
    if (item.rest || timedPlan) onRest(item, true);
    if (next >= plannedSets) {
      setPendingFill(next);
      completeTimerRef.current = window.setTimeout(() => {
        onChange({ setsDone: next, done: true, skipped: false });
      }, 400);
    } else {
      onChange({ setsDone: next });
    }
  };

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
    const el = e.target as HTMLElement;
    if (el.closest('a,button,input,textarea,select,label')) return;
    setOpen((v) => !v);
  };

  const detailControls = (
            <span className="ml-auto flex shrink-0 items-center text-muted">
              {(onEdit || videoUrl) && <ActionMenu label={`${t.actions.exerciseActions}: ${name}`} actions={[
                ...(videoUrl ? [{ label: t.item.techVideo, href: videoUrl }] : []),
                ...(onEdit ? [{ label: t.actions.editWorkout, run: onEdit }] : []),
                ...(onMove ? [{ label: t.actions.moveExercise, run: onMove }] : []),
                ...(active && !item.done && !item.skipped ? [{ label: t.actions.skipExercise, run: () => onChange({ skipped: true, done: false }) }] : []),
                ...(onRemove ? [{ label: t.actions.removeFromWorkout, run: onRemove, danger: true }] : []),
              ]} />}
              <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={[open ? t.item.collapse : t.item.expand, myComment ? t.item.hasMyComment : '', item.ptNote || item.ptRequest ? t.item.hasPtNote : ''].filter(Boolean).join('. ')}
                className="relative flex h-11 w-11 items-center justify-center rounded-lg"
              >
                <ChevronIcon open={open} />
                {(myComment || item.ptNote || item.ptRequest) && <span aria-hidden="true" className="absolute right-2 top-2 h-1 w-1 rounded-full bg-accent" />}
              </button>
            </span>
  );

  return (
    <div
      data-workout-item={item.id}
      data-item-expanded={open}
      onClick={handleCardClick}
      className="cursor-pointer rounded-2xl border border-border bg-card p-4"
    >
      {/* One left edge for the title, preparation and working values. */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
        <h3
          className={
            'min-w-0 break-words pt-1.5 text-lg font-bold leading-snug ' +
            (item.done
              ? 'text-muted'
              : item.skipped
                ? 'text-muted line-through decoration-1'
                : '')
          }
        >
          {kind !== 'cardio' && <span className="sr-only">{num}. </span>}
          {name || t.item.fallbackName}
        </h3>
        {/* Разминка упражнения — первой: с неё начинают и её читают первой */}
        {item.warmupSets && (
          <p className="mt-2 flex flex-wrap gap-x-2 text-sm leading-relaxed">
            <span className="mt-0.5 shrink-0 text-muted" title={t.item.warmupLabel}><FlameIcon size={18} /><span className="sr-only">{t.item.warmupLabel}</span></span>
            <span className="min-w-0 whitespace-pre-line break-words">{item.warmupSets}</span>
          </p>
        )}
        </div>
        <button
          onClick={() => {
            // отметка «выполнено» заодно снимает пропуск
            onChange(item.done ? { done: false } : { done: true, skipped: false });
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


        {/* Строка данных: повторы × вес + отдых; справа — значки
            «есть комментарий» / «есть заметка тренера» и шеврон раскрытия.
            Правка плана и результата доступна через меню действий. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {mainChips.map((c, i) => (
              <span
                key={i}
                title={c.name ?? undefined}
                className={
                  'inline-flex max-w-full items-center gap-1.5 text-sm tabular-nums ' +
                  (c.bold ? 'font-bold' : 'font-medium')
                }
              >
                {c.icon && <span className="shrink-0 text-muted">{c.icon}</span>}
                {c.name && <span className="sr-only">{c.name}: </span>}
                <span className="min-w-0 break-words">{c.text}</span>
              </span>
            ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
            {!locked && !item.done && !item.skipped && nextSeconds != null && onTime && (
              <button type="button" onClick={() => onTime(item)} aria-label={t.timer.startSet}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-fg">
                <TimerIcon name="play" /><span>{t.timer.startSetShort} · {fmtClock(nextSeconds)}</span>
              </button>
            )}
            {(item.rest || timedPlan) && (
              <button
                onClick={() => onRest(item)}
                aria-label={t.item.startRest}
                title={t.item.rest}
                className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-2 text-left text-sm font-bold text-accent"
              >
                <ClockIcon size={16} />
                <span>{t.timer.title}</span>
                <span className="min-w-0 break-words">{timedPlan ? fmtClock(parseRestSeconds(item.rest)) : restLabel(item.rest!, t)}</span>
              </button>
            )}
            {plannedSets === 0 && detailControls}
          </div>

        {/* Кружки подходов (режим «идёт»): тап — подход сделан, повторный —
            снятие; последний кружок сам завершает упражнение */}
        {plannedSets > 0 && (
          <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
            <div className="min-w-0 flex-1">
            <span className="mb-2 block text-sm text-muted">
              {t.item.setsRowLabel}
            </span>
            <div className="flex flex-wrap gap-2">
            {Array.from({ length: plannedSets }, (_, i) => {
              const on = i < setsDone || (pendingFill != null && i < pendingFill);
              return (
                <button
                  key={i}
                  onClick={() => tapBubble(i)}
                  onAnimationEnd={() => setPopIdx((v) => (v === i ? null : v))}
                  aria-pressed={on}
                  aria-label={t.item.setBubbleAria(i + 1)}
                  className={
                    'flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold tabular-nums transition-colors ' +
                    (on ? 'border-ok bg-ok text-ok-fg' : 'border-border bg-card text-muted') +
                    (popIdx === i ? ' anim-check' : '')
                  }
                >
                  {i + 1}
                </button>
              );
            })}
            </div>
            </div>
            {detailControls}
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
                      'inline-flex max-w-full items-center gap-1.5 text-sm tabular-nums ' +
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
              <p title={t.item.lastTime} className="mt-3 flex items-start gap-1.5 text-sm text-muted">
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
          <CommentEditor item={item} open={open} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

/* --- Лёгкий редактор: комментарий + быстрый лог факта ------------------- */

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
          <span className="text-sm font-semibold text-muted">
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
        <p className="mt-2 text-sm text-muted">{t.item.oldFactNote(item.actual?.text ?? '')}</p>
      )}
    </div>
  );
}
