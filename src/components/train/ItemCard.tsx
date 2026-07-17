// Карточка одного упражнения в тренировке: чипы параметров, заметки тренера,
// «прошлый раз», отметка «выполнено» и лёгкий редактор (комментарий + факт).

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { Actual, Exercise, WorkoutItem } from '../../types';
import type { Occurrence } from '../../store';
import { fmtDateShort } from '../../lib/dates';
import VideoLink from './VideoLink';
import {
  CheckIcon,
  ChevronIcon,
  CommentIcon,
  DeadFaceIcon,
  FlameIcon,
  HistoryIcon,
  KettlebellIcon,
  PinIcon,
  RechargeIcon,
  RepeatIcon,
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

/** Для чипа: «1.5» → «1.5 мин», а «2 мин» / свободный текст — как есть */
function restLabel(rest: string): string {
  const t = rest.trim();
  return /^[\d.,\s\-–—+]+$/.test(t) ? `${t} мин` : t;
}

/** Для чипа: «27.5» → «27.5 кг», а «12+12 кг» / свободный текст — как есть */
function weightLabel(weight: string): string {
  const t = weight.trim();
  return /^[\d.,\s\-–—+]+$/.test(t) ? `${t} кг` : t;
}

/** Короткая строка «что было в прошлый раз» */
function lastSummary(it: WorkoutItem): string {
  let core = '';
  if (it.actual) {
    const parts: string[] = [];
    if (it.actual.weight != null) parts.push(`${it.actual.weight} кг`);
    if (it.actual.sets != null && it.actual.reps != null)
      parts.push(`${it.actual.sets}×${it.actual.reps}`);
    else if (it.actual.sets != null) parts.push(`${it.actual.sets} подх.`);
    else if (it.actual.reps != null) parts.push(`${it.actual.reps} повт.`);
    core = parts.join(' × ');
    const txt = (it.actual.text ?? '').trim();
    if (txt) core = core ? `${core}, ${txt}` : txt;
  }
  if (!core) {
    const parts: string[] = [];
    if (it.setsReps?.raw) parts.push(it.setsReps.raw);
    if (it.weight?.raw) parts.push(`вес ${it.weight.raw}`);
    core = parts.join(', ');
  }
  const comment = (it.myComment ?? '').trim().replace(/\s+/g, ' ');
  if (comment) core = core ? `${core} · ${comment}` : comment;
  return core || 'без записи';
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
  const [open, setOpen] = useState(false);
  // «чпок» галочки только на живой тап, не при монтировании карточки
  const [checkPop, setCheckPop] = useState(false);

  const name = exercise?.name ?? stripNumbering(item.nameRaw ?? '');
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
      ? weightLabel(String(item.actual.weight))
      : item.weight?.raw
        ? weightLabel(item.weight.raw)
        : '';

  const chips: { icon: ReactNode | null; name: string | null; text: string }[] = [];
  if (setsRepsText)
    chips.push({ icon: <RepeatIcon />, name: 'подходы × повторы', text: setsRepsText });
  if (weightText) chips.push({ icon: <KettlebellIcon />, name: 'вес', text: weightText });
  if (item.pvr)
    chips.push({ icon: <DeadFaceIcon />, name: 'ПВР — повторы в резерве', text: item.pvr });
  if (item.tempo) chips.push({ icon: <TempoIcon />, name: 'темп', text: item.tempo });

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
            (item.done ? 'bg-bg text-muted' : 'bg-accent-soft text-accent')
          }
        >
          {num}
        </span>
        <h3
          className={
            'min-w-0 flex-1 break-words text-lg font-semibold leading-snug ' +
            (item.done ? 'text-muted' : '')
          }
        >
          <span className="sr-only">{num}. </span>
          {name || 'Упражнение'}
        </h3>
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Видео техники"
            title="Видео техники"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <VideoIcon />
          </a>
        )}
        <button
          onClick={() => {
            onChange({ done: !item.done });
            setCheckPop(true);
          }}
          onAnimationEnd={() => setCheckPop(false)}
          disabled={locked}
          aria-pressed={item.done}
          aria-label={item.done ? 'Снять отметку «выполнено»' : 'Отметить выполненным'}
          title={locked ? 'Тренировка завершена — отметки закрыты (замок внизу)' : undefined}
          className={
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ' +
            (item.done
              ? 'border-accent bg-accent text-accent-fg'
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
          <p title="разминка" className="mt-2.5 flex items-start gap-1.5 text-sm">
            <span className="mt-0.5 shrink-0 text-accent">
              <FlameIcon />
            </span>
            <span className="sr-only">разминка: </span>
            <span className="min-w-0 whitespace-pre-line break-words text-muted">
              {item.warmupSets}
            </span>
          </p>
        )}

        {/* Чипы параметров */}
        {(chips.length > 0 || item.rest) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {chips.map((c, i) => (
              <span
                key={i}
                title={c.name ?? undefined}
                className="inline-flex max-w-full items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-sm font-medium"
              >
                {c.icon && <span className="shrink-0 text-accent">{c.icon}</span>}
                {c.name && <span className="sr-only">{c.name}: </span>}
                <span className="min-w-0 break-words">{c.text}</span>
              </span>
            ))}
            {item.rest && (
              <button
                onClick={() => onRest(item)}
                aria-label="Запустить таймер отдыха"
                title="отдых"
                className="relative inline-flex max-w-full items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-left text-sm font-medium underline decoration-dotted underline-offset-2 after:absolute after:-inset-1.5 after:content-['']"
              >
                <span className="shrink-0 text-accent">
                  <RechargeIcon />
                </span>
                <span className="sr-only">отдых: </span>
                <span className="min-w-0 break-words">{restLabel(item.rest)}</span>
              </button>
            )}
          </div>
        )}

        {/* Техника: подсказки-подпункты */}
        {item.subNotes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {item.subNotes.map((sn, i) => (
              <li key={i} className="break-words text-sm leading-snug text-muted">
                {sn.text}
                {sn.videoUrl && <VideoLink href={sn.videoUrl} className="ml-1.5" />}
              </li>
            ))}
          </ul>
        )}

        {/* Примечание тренера — всегда последним и всегда с булавкой;
            строки с 📌 — просьбы на этот день, они выделены жирнее */}
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
                    <p key={i} className={'break-words ' + (pinned ? 'font-medium' : 'text-muted')}>
                      {t.replace(/^📌\s*/, '')}
                    </p>
                  );
                })}
              {/* совместимость со старыми данными, где запрос лежал отдельным полем */}
              {item.ptRequest && (
                <p className="whitespace-pre-line break-words font-medium">{item.ptRequest}</p>
              )}
            </div>
          </div>
        )}

        {/* Твой комментарий — в свёрнутом виде одной-двумя строками */}
        {!open && myComment && (
          <p title="твой комментарий" className="mt-2 flex items-start gap-1.5 text-sm italic text-muted">
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              <CommentIcon />
            </span>
            <span className="sr-only">твой комментарий: </span>
            <span className="min-w-0 break-words line-clamp-2">{myComment}</span>
          </p>
        )}

        {/* Прошлый раз (иконка «Истории») + шеврон */}
        <div className="mt-3 flex items-center gap-2">
          {last ? (
            <p
              title="прошлый раз"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted"
            >
              <span className="shrink-0" aria-hidden="true">
                <HistoryIcon />
              </span>
              <span className="sr-only">прошлый раз, </span>
              <span className="min-w-0 flex-1 truncate">
                {fmtDateShort(last.workout.date)}: {lastSummary(last.item)}
              </span>
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Свернуть' : 'Развернуть'}
            className="relative -my-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted after:absolute after:-inset-1.5 after:content-['']"
          >
            <ChevronIcon open={open} />
          </button>
        </div>
      </div>

      {open && <ItemEditor item={item} onChange={onChange} />}
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
  onChange,
}: {
  item: WorkoutItem;
  onChange: (patch: Partial<WorkoutItem>) => void;
}) {
  const [comment, setComment] = useState(item.myComment ?? '');
  const [wStr, setWStr] = useState(numToStr(item.actual?.weight ?? item.weight?.value));
  const [sStr, setSStr] = useState(numToStr(item.actual?.sets ?? item.setsReps?.sets));
  const [rStr, setRStr] = useState(numToStr(item.actual?.reps ?? item.setsReps?.reps));
  const [tStr, setTStr] = useState(item.actual?.text ?? '');
  const [factDirty, setFactDirty] = useState(false);
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

  const commitComment = () => {
    if (comment === (item.myComment ?? '')) return;
    onChange({ myComment: comment });
    flashSaved();
  };

  // Сохраняем факт только если поля реально трогали — иначе не выдумываем actual
  const commitFact = () => {
    if (!factDirty) return;
    const weight = parseNum(wStr);
    const sets = parseIntOrNull(sStr);
    const reps = parseIntOrNull(rStr);
    const text = tStr.trim();
    const actual: Actual | null =
      weight == null && sets == null && reps == null && text === ''
        ? null
        : { weight, sets, reps, text };
    onChange({ actual });
    setFactDirty(false);
    flashSaved();
  };

  const fieldCls =
    'mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-base outline-none focus:border-accent';

  return (
    <div className="anim-rise mt-4 border-t border-border pt-4" onClick={(e) => e.stopPropagation()}>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Твой комментарий
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={commitComment}
          rows={2}
          placeholder="Как прошло?"
          className={fieldCls + ' resize-y'}
        />
      </label>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Факт</span>
          <span
            aria-live="polite"
            className={
              'text-xs font-medium text-ok transition-opacity duration-300 ' +
              (saved ? 'opacity-100' : 'opacity-0')
            }
          >
            сохранено
          </span>
        </div>

        <div className="mt-1 grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-muted">Вес, кг</span>
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
              className={fieldCls + ' tabular-nums'}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Подходы</span>
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
              className={fieldCls + ' tabular-nums'}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Повторы</span>
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
              className={fieldCls + ' tabular-nums'}
            />
          </label>
        </div>

        <input
          type="text"
          value={tStr}
          onChange={(e) => {
            setTStr(e.target.value);
            setFactDirty(true);
          }}
          onBlur={commitFact}
          placeholder="Заметка к факту (необязательно)"
          className={fieldCls + ' mt-2'}
        />
      </div>
    </div>
  );
}
