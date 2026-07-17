// Экран «Тренировка»: текущая (или выбранная) тренировка целиком —
// разминка, упражнения с чипами и быстрым логом, усталость, заметки тренера.

import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { fmtDate, fmtWeekday } from '../lib/dates';
import type { Workout, WorkoutItem } from '../types';
import WorkoutEditor from '../components/edit/WorkoutEditor';
import ItemCard from '../components/train/ItemCard';
import RestTimer, { parseRestSeconds, type RestRequest } from '../components/train/RestTimer';
import VideoLink from '../components/train/VideoLink';
import { ChevronIcon } from '../components/train/icons';

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

  if (loading) return null;

  const w = currentWorkout;
  if (!w) {
    return (
      <EmptyState
        onEdit={() => setEditMode(true)}
        onMenu={() => navigate('menu')}
      />
    );
  }

  const index = workouts.findIndex((x) => x.id === w.id);
  const prev = index > 0 ? workouts[index - 1] : null;
  const next = index >= 0 && index < workouts.length - 1 ? workouts[index + 1] : null;

  const saveItem = (itemId: string, patch: Partial<WorkoutItem>) => {
    saveWorkout({
      ...w,
      items: w.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    });
  };

  const sortedItems = [...w.items].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const warmupOpen = warmupOpenMap[w.id] ?? w.status === 'planned';
  const notesOpen = notesOpenMap[w.id] ?? false;

  return (
    <div className="space-y-4">
      <TopBlock w={w} prev={prev} next={next} onOpen={(id) => navigate('train', id)} />

      {editMode ? (
        <WorkoutEditor workout={w} />
      ) : (
        <>
          {/* Разминка */}
          {(w.warmup.length > 0 || w.warmupVideoUrl) && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setWarmupOpenMap((m) => ({ ...m, [w.id]: !warmupOpen }))
                  }
                  aria-expanded={warmupOpen}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Разминка
                  </span>
                  {w.warmup.length > 0 && (
                    <span className="text-sm text-muted">{w.warmup.length}</span>
                  )}
                  <span className="text-muted">
                    <ChevronIcon open={warmupOpen} size={18} />
                  </span>
                </button>
                {w.warmupVideoUrl && <VideoLink href={w.warmupVideoUrl} />}
              </div>
              {warmupOpen && w.warmup.length > 0 && (
                <ul className="mt-2 space-y-2.5">
                  {w.warmup.map((wu, i) => {
                    const line = parseWarmupLine(wu.text, i + 1);
                    return (
                      <li key={i} className="flex items-start gap-2 text-[15px] leading-snug">
                        <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-bg px-1 text-[11px] font-semibold tabular-nums text-muted">
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

          {/* Конец тренировки: усталость + статус */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Усталость после тренировки
            </h2>
            <div className="mt-3 grid grid-cols-5 justify-items-center gap-2 md:grid-cols-10">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => saveWorkout({ ...w, fatigue: w.fatigue === n ? null : n })}
                  aria-pressed={w.fatigue === n}
                  aria-label={`Усталость ${n} из 10`}
                  className={
                    'flex h-11 w-11 items-center justify-center rounded-full border text-base font-semibold transition-colors ' +
                    (w.fatigue === n
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border bg-bg text-muted')
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-4">
              {w.status === 'planned' ? (
                <button
                  onClick={() => saveWorkout({ ...w, status: 'done' })}
                  className="w-full rounded-xl bg-accent px-4 py-2.5 text-lg font-semibold text-accent-fg"
                >
                  Завершить тренировку
                </button>
              ) : (
                <button
                  onClick={() => saveWorkout({ ...w, status: 'planned' })}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted"
                >
                  Вернуть в запланированные
                </button>
              )}
            </div>
          </section>

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
                <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed">
                  {w.notes}
                </p>
              )}
            </section>
          )}

          <RestTimer request={restRequest} />
        </>
      )}
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
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <NavButton
        dir="prev"
        disabled={!prev}
        onClick={() => prev && onOpen(prev.id)}
      />
      <div className="min-w-0 flex-1 text-center">
        <h2 className="text-lg font-bold leading-snug">
          {fmtDate(w.date)}, {fmtWeekday(w.date)}
        </h2>
        {w.title && <div className="mt-0.5 break-words text-sm text-muted">{w.title}</div>}
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
          {w.status === 'done' ? (
            <span className="rounded-full border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">
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
