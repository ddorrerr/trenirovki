// Экран «Тренировка»: текущая (или выбранная) тренировка целиком —
// разминка, упражнения с чипами и быстрым логом, усталость, заметки тренера.

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { fmtDate, fmtWeekday } from '../lib/dates';
import type { Workout, WorkoutItem } from '../types';
import WorkoutEditor from '../components/edit/WorkoutEditor';
import NewWorkoutForm from '../components/edit/NewWorkoutForm';
import ItemCard from '../components/train/ItemCard';
import RestTimer, { parseRestSeconds, type RestRequest } from '../components/train/RestTimer';
import VideoLink from '../components/train/VideoLink';
import { CheckIcon, ChevronIcon, VideoIcon } from '../components/train/icons';

/**
 * Разбираем строку разминки из таблицы: маркеры «-», «•» убираем, нумерацию
 * вида «1.1», «2)» выносим в маленькую плашку перед текстом; если номера
 * в тексте нет — берём порядковый. Числа-содержание («10 приседаний») не трогаем.
 */
function parseWarmupLine(t: string, fallbackNum: number): { label: string; text: string } {
  const m = /^\s*(?:[-–—•]\s*)?(?:((?:\d+(?:\.\d+)+[.)]?|\d+[.)]))\s*)?(?:[-–—•]\s*)?([\s\S]*)$/.exec(
    t,
  );
  const label = m?.[1] ? m[1].replace(/[.)]$/, '') : String(fallbackNum);
  const text = (m?.[2] ?? '').trim() || t.trim();
  return { label, text };
}

export default function TrainingScreen() {
  const {
    loading,
    workouts,
    currentWorkout,
    openWorkoutId,
    navigate,
    editMode,
    setEditMode,
    exerciseById,
    lastResultBefore,
    saveWorkout,
  } = useApp();

  // В режиме редактирования «последняя тренировка» фиксируется по id:
  // иначе правка даты пересортировала бы список и подменила бы редактируемую.
  useEffect(() => {
    if (editMode && !openWorkoutId && currentWorkout) navigate('train', currentWorkout.id);
  }, [editMode, openWorkoutId, currentWorkout, navigate]);

  // Свёрнутость блоков помним на время сессии, отдельно для каждой тренировки
  const [warmupOpenMap, setWarmupOpenMap] = useState<Record<string, boolean>>({});
  const [notesOpenMap, setNotesOpenMap] = useState<Record<string, boolean>>({});
  const [restRequest, setRestRequest] = useState<RestRequest | null>(null);
  /* Завершённая тренировка «закрыта»: отметки упражнений, разминки и ползунок
     усталости не реагируют, пока не открыть замок внизу (на время сессии). */
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>({});
  const [warmupPop, setWarmupPop] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  /* Слайд при листании тренировок (стрелки или свайп); null — без анимации */
  const [wAnim, setWAnim] = useState<null | 'left' | 'right'>(null);
  const prevIdRef = useRef<string | null>(null);
  const touchRef = useRef<{ x: number; y: number; ok: boolean } | null>(null);

  if (loading) return null;

  const w = currentWorkout;
  if (!w) {
    return editMode ? (
      <NewWorkoutForm />
    ) : (
      <EmptyState
        onEdit={() => setEditMode(true)}
        onMenu={() => navigate('menu')}
      />
    );
  }

  const index = workouts.findIndex((x) => x.id === w.id);
  const prev = index > 0 ? workouts[index - 1] : null;
  const next = index >= 0 && index < workouts.length - 1 ? workouts[index + 1] : null;

  // Направление слайда при смене открытой тренировки (derived-state паттерн)
  if (prevIdRef.current === null) {
    prevIdRef.current = w.id;
  } else if (prevIdRef.current !== w.id) {
    const prevW = workouts.find((x) => x.id === prevIdRef.current);
    prevIdRef.current = w.id;
    setWAnim(!prevW || prevW.date <= w.date ? 'right' : 'left');
  }

  /* Свайп влево/вправо листает тренировки; жест не перехватываем на полях,
     ползунке и шторке таймера, в редакторе выключен целиком */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const el = e.target as HTMLElement;
    const ok = !editMode && !el.closest('input, textarea, select, .fixed');
    touchRef.current = { x: t.clientX, y: t.clientY, ok };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s || !s.ok || editMode) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const target = dx < 0 ? next : prev;
    if (target) navigate('train', target.id);
  };

  const saveItem = (itemId: string, patch: Partial<WorkoutItem>) => {
    saveWorkout({
      ...w,
      items: w.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    });
  };

  const sortedItems = [...w.items].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const warmupOpen = warmupOpenMap[w.id] ?? (w.status === 'planned' && !w.warmupDone);
  const notesOpen = notesOpenMap[w.id] ?? false;
  const workoutLocked = w.status === 'done' && !unlockedMap[w.id];

  return (
    <div className="space-y-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div
        key={w.id}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setWAnim(null);
        }}
        className={
          'space-y-4' +
          (wAnim === 'right' ? ' anim-screen-right' : wAnim === 'left' ? ' anim-screen-left' : '')
        }
      >
      <TopBlock w={w} prev={prev} next={next} onOpen={(id) => navigate('train', id)} />

      {editMode ? (
        <>
          {/* Тренеру не нужно ходить в «Историю», чтобы добавить тренировку */}
          <NewWorkoutForm />
          <WorkoutEditor workout={w} />
        </>
      ) : (
        <>
          {/* Разминка: шапка как у карточки упражнения — видео и «выполнено» */}
          {(w.warmup.length > 0 || w.warmupVideoUrl) && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={() =>
                    setWarmupOpenMap((m) => ({ ...m, [w.id]: !warmupOpen }))
                  }
                  aria-expanded={warmupOpen}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={
                      'text-sm font-semibold uppercase tracking-wide ' +
                      (w.warmupDone ? 'text-muted' : '')
                    }
                  >
                    Разминка
                  </span>
                  {w.warmup.length > 0 && (
                    <span className="text-sm text-muted">{w.warmup.length}</span>
                  )}
                  <span className="text-muted">
                    <ChevronIcon open={warmupOpen} size={18} />
                  </span>
                </button>
                {w.warmupVideoUrl && (
                  <a
                    href={w.warmupVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Видео разминки"
                    title="Видео разминки"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                  >
                    <VideoIcon />
                  </a>
                )}
                <button
                  onClick={() => {
                    saveWorkout({ ...w, warmupDone: !w.warmupDone });
                    // «чпок» — только при отметке; снятие отметки происходит без праздника
                    if (!w.warmupDone) setWarmupPop(true);
                  }}
                  onAnimationEnd={() => setWarmupPop(false)}
                  disabled={workoutLocked}
                  aria-pressed={w.warmupDone ?? false}
                  aria-label={
                    w.warmupDone ? 'Снять отметку «разминка выполнена»' : 'Разминка выполнена'
                  }
                  title={
                    workoutLocked ? 'Тренировка завершена — отметки закрыты (замок внизу)' : undefined
                  }
                  className={
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ' +
                    (w.warmupDone
                      ? 'border-ok bg-ok text-ok-fg'
                      : 'border-border bg-card text-muted') +
                    (warmupPop ? ' anim-check' : '')
                  }
                >
                  <CheckIcon />
                </button>
              </div>
              {warmupOpen && w.warmup.length > 0 && (
                <ul className={'anim-rise mt-2 space-y-2.5 ' + (w.warmupDone ? 'opacity-70' : '')}>
                  {w.warmup.map((wu, i) => {
                    const line = parseWarmupLine(wu.text, i + 1);
                    return (
                      <li key={i} className="flex items-start gap-2 text-[15px] leading-snug">
                        <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-chip px-1 text-[11px] font-semibold tabular-nums text-muted">
                          {line.label}
                        </span>
                        <span className="min-w-0 break-words">
                          {line.text}
                          {wu.videoUrl && <VideoLink href={wu.videoUrl} className="ml-1.5" />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Упражнения */}
          <section className="space-y-3">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">
              Упражнения
            </h2>
            {sortedItems.length === 0 && (
              <p className="rounded-2xl border border-border bg-card p-4 text-muted">
                В этой тренировке пока нет упражнений.
              </p>
            )}
            {sortedItems.map((it, i) => (
              <ItemCard
                key={it.id}
                item={it}
                num={i + 1}
                locked={workoutLocked}
                exercise={it.exerciseId ? exerciseById(it.exerciseId) : undefined}
                last={it.exerciseId ? lastResultBefore(it.exerciseId, w.date, w.id) : null}
                onChange={(patch) => saveItem(it.id, patch)}
                onRest={(item) =>
                  setRestRequest((prevReq) => ({
                    itemId: item.id,
                    seconds: parseRestSeconds(item.rest),
                    nonce: (prevReq?.nonce ?? 0) + 1,
                  }))
                }
              />
            ))}
          </section>

          {/* Конец тренировки: усталость + завершение-замок */}
          <section className="relative rounded-2xl border border-border bg-card p-4">
            {celebrate && <ConfettiBurst />}
            <FatigueBlock
              w={w}
              workoutLocked={workoutLocked}
              onSave={(f) => saveWorkout({ ...w, fatigue: f })}
            />
            <div className="mt-4">
              {w.status === 'planned' ? (
                <button
                  onClick={() => {
                    saveWorkout({ ...w, status: 'done' });
                    // завершение всегда закрывает замок заново
                    setUnlockedMap((m) => ({ ...m, [w.id]: false }));
                    setCelebrate(true);
                    window.setTimeout(() => setCelebrate(false), 1200);
                  }}
                  className="w-full rounded-xl bg-accent px-4 py-2.5 text-lg font-bold text-accent-fg"
                >
                  Завершить тренировку
                </button>
              ) : (
                /* Общий замок: «Завершить» закрывает отметки всей тренировки */
                <button
                  onClick={() => setUnlockedMap((m) => ({ ...m, [w.id]: workoutLocked }))}
                  aria-pressed={!workoutLocked}
                  className={
                    'flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ' +
                    (workoutLocked
                      ? 'border-border bg-bg text-muted'
                      : 'border-accent/50 bg-accent-soft text-accent')
                  }
                >
                  <LockIcon open={!workoutLocked} />
                  {workoutLocked
                    ? 'Тренировка завершена — отметки закрыты'
                    : 'Отметки открыты — нажми, чтобы закрыть'}
                </button>
              )}
            </div>
          </section>

          {/* «Вернуть в запланированные» — отдельно, появляется после разблокировки */}
          {w.status === 'done' && !workoutLocked && (
            <button
              onClick={() => saveWorkout({ ...w, status: 'planned' })}
              className="anim-rise w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted"
            >
              Вернуть в запланированные
            </button>
          )}

          {/* Заметки тренера */}
          {w.notes.trim() !== '' && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <button
                onClick={() => setNotesOpenMap((m) => ({ ...m, [w.id]: !notesOpen }))}
                aria-expanded={notesOpen}
                className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Заметки тренера
                </span>
                <span className="text-muted">
                  <ChevronIcon open={notesOpen} size={18} />
                </span>
              </button>
              {notesOpen && (
                <p className="anim-rise mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed">
                  {w.notes}
                </p>
              )}
            </section>
          )}

        </>
      )}
      </div>

      {/* Таймер вне «листаемого» блока: смена тренировки не сбрасывает отсчёт */}
      {!editMode && <RestTimer request={restRequest} />}
    </div>
  );
}

/* --- Верхний блок: дата, статус, листание --------------------------------- */

function TopBlock({
  w,
  prev,
  next,
  onOpen,
}: {
  w: Workout;
  prev: Workout | null;
  next: Workout | null;
  onOpen: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <NavButton
        dir="prev"
        disabled={!prev}
        onClick={() => prev && onOpen(prev.id)}
      />
      <div className="min-w-0 flex-1 text-center">
        <h2 className="text-xl font-extrabold leading-snug tracking-tight">
          {fmtDate(w.date)}, {fmtWeekday(w.date)}
        </h2>
        {w.title && <div className="mt-0.5 break-words text-sm text-muted">{w.title}</div>}
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
          {w.status === 'done' ? (
            <span className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-bold text-ok-text">
              выполнена
            </span>
          ) : (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
              запланирована
            </span>
          )}
          {w.type && (
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted">
              {w.type}
            </span>
          )}
        </div>
        {/* Быстрый возврат из старых тренировок к самой свежей */}
        {next && (
          <button
            type="button"
            onClick={() => onOpen(null)}
            className="anim-rise mx-auto mt-2 flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent"
          >
            к последней тренировке
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 6l6 6-6 6M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
      <NavButton
        dir="next"
        disabled={!next}
        onClick={() => next && onOpen(next.id)}
      />
    </div>
  );
}

function NavButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Предыдущая тренировка' : 'Следующая тренировка'}
      className={
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card ' +
        (disabled ? 'opacity-35' : 'active:bg-accent-soft')
      }
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dir === 'prev' ? <path d="M14.5 6l-6 6 6 6" /> : <path d="M9.5 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

/* --- Сдержанное конфетти на «Завершить тренировку» ------------------------- */

/* Цвета конфетти — из палитры: вольт солирует, петроль и янтарь поддерживают */
const CONFETTI_DOTS = [
  { dx: -90, dy: -120, d: 0, c: 'var(--accent)', s: 8 },
  { dx: -50, dy: -150, d: 60, c: 'var(--warn)', s: 7 },
  { dx: 0, dy: -170, d: 20, c: 'var(--ok)', s: 9 },
  { dx: 55, dy: -145, d: 80, c: 'var(--ok)', s: 7 },
  { dx: 95, dy: -110, d: 40, c: 'var(--accent)', s: 8 },
  { dx: -120, dy: -60, d: 90, c: 'var(--danger)', s: 6 },
  { dx: 120, dy: -55, d: 30, c: 'var(--warn)', s: 6 },
  { dx: -70, dy: -35, d: 120, c: 'var(--ok)', s: 6 },
  { dx: 70, dy: -28, d: 100, c: 'var(--warn)', s: 7 },
  { dx: -25, dy: -95, d: 140, c: 'var(--danger)', s: 5 },
  { dx: 30, dy: -120, d: 110, c: 'var(--ok)', s: 5 },
  { dx: 0, dy: -60, d: 160, c: 'var(--accent)', s: 5 },
];

function ConfettiBurst() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {CONFETTI_DOTS.map((p, i) => (
        <span
          key={i}
          className="anim-confetti confetti-dot absolute left-1/2 top-[72%] rounded-full"
          style={
            {
              width: p.s,
              height: p.s,
              background: p.c,
              animationDelay: `${p.d}ms`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* --- Усталость: ползунок со смайликом и замком от случайных сдвигов -------- */

/** Каждой оценке — свой цвет по палитре: лайм → янтарь → коралл */
function fatigueColor(level: number): string {
  const hue = Math.round(85 - ((level - 1) / 9) * 85);
  return `hsl(${hue} 78% 44%)`;
}

/** Лицо едет вместе с ползунком: улыбка → гримаса → крестики-глаза */
function FatigueFace({ level, size = 26 }: { level: number; size?: number }) {
  const dead = level >= 9;
  // кривизна рта: +3.8 (улыбка, y вниз) → −3.8 (грусть)
  const c = 3.8 - ((level - 1) / 9) * 7.6;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      {dead ? (
        <>
          <path d="M7.4 7.9l2.8 2.8M10.2 7.9l-2.8 2.8" />
          <path d="M13.8 7.9l2.8 2.8M16.6 7.9l-2.8 2.8" />
        </>
      ) : (
        <>
          <circle cx="9" cy="9.7" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9.7" r="1.15" fill="currentColor" stroke="none" />
        </>
      )}
      <path d={`M8.3 15.4 Q12 ${(15.4 + c).toFixed(1)} 15.7 15.4`} />
    </svg>
  );
}

function LockIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      {open ? <path d="M8 10.5V7a4 4 0 0 1 7.7-1.5" /> : <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />}
    </svg>
  );
}

function FatigueBlock({
  w,
  workoutLocked,
  onSave,
}: {
  w: Workout;
  /** Общий замок завершённой тренировки — закрывает и ползунок */
  workoutLocked: boolean;
  onSave: (fatigue: number | null) => void;
}) {
  const saved = w.fatigue;
  const [draft, setDraft] = useState<number | null>(null);

  // другая тренировка — чистое состояние
  useEffect(() => {
    setDraft(null);
  }, [w.id, saved]);

  // один замок на всю тренировку — свой у ползунка больше не нужен
  const locked = workoutLocked;
  const marked = saved != null || draft != null;
  const value = draft ?? saved ?? 5;
  const color = fatigueColor(value);

  const commit = () => {
    if (draft != null && draft !== saved) onSave(draft);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Усталость после тренировки
          {marked && (
            <>
              {' — '}
              {/* подмешиваем цвет текста к --fg: читаемо и в светлой, и в тёмной теме */}
              <span
                style={{ color: `color-mix(in oklab, ${color} 55%, var(--fg))` }}
                className="tabular-nums"
              >
                {value}/10
              </span>
            </>
          )}
        </h2>
      </div>

      <div className="relative mt-10 @container">
        {/* сдвиг через transform (GPU, не даёт пересчёта раскладки при каждом
            шаге); 100cqw — ширина родителя, ему для этого дан @container */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 -top-8 transition-[transform,color] duration-100"
          style={{
            transform: `translateX(calc(${((value - 1) / 9).toFixed(4)} * (100cqw - 28px) + 1px))`,
            color: marked ? color : 'var(--muted)',
          }}
        >
          <FatigueFace level={value} />
        </span>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          disabled={locked}
          aria-label="Усталость после тренировки, от 1 до 10"
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="fatigue"
          style={
            marked
              ? ({
                  '--fill': `${(((value - 1) / 9) * 100).toFixed(1)}%`,
                  '--fill-color': color,
                } as React.CSSProperties)
              : undefined
          }
        />
        <div className="flex justify-between text-xs text-muted">
          <span>1 — легко</span>
          <span>10 — умираю</span>
        </div>
      </div>

      {!marked && !locked && (
        <p className="mt-2 text-sm text-muted">Сдвинь ползунок, чтобы отметить усталость.</p>
      )}
      {marked && !locked && saved != null && (
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            onSave(null);
          }}
          className="mt-2 text-sm text-muted underline decoration-dotted underline-offset-2"
        >
          убрать отметку
        </button>
      )}
    </>
  );
}

/* --- Пустое состояние ------------------------------------------------------ */

function EmptyState({ onEdit, onMenu }: { onEdit: () => void; onMenu: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
        className="text-muted"
      >
        <path d="M7 8v8M4.5 9.5v5M17 8v8M19.5 9.5v5M7 12h10" />
      </svg>
      <div>
        <p className="text-lg font-semibold">Пока нет ни одной тренировки</p>
        <p className="mx-auto mt-1.5 max-w-sm text-muted">
          Включи режим редактирования — кнопка-карандаш сверху — и добавь свою первую
          тренировку. Настройки найдёшь в «Меню».
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={onEdit}
          className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg"
        >
          Включить редактирование
        </button>
        <button
          onClick={onMenu}
          className="rounded-xl border border-border bg-card px-4 py-2.5 font-medium"
        >
          Открыть меню
        </button>
      </div>
    </div>
  );
}
