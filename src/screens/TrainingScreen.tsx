import CycleSummary from '../components/CycleSummary';
// Экран «Тренировка»: текущая (или выбранная) тренировка целиком —
// разминка, упражнения с чипами и быстрым логом, усталость, заметки тренера.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useApp } from '../store';
import { useT, type Dict } from '../i18n';
import { fmtDate, fmtWeekday } from '../lib/dates';
import { exerciseKind, type Exercise, type ExerciseKind, type Workout, type WorkoutItem } from '../types';
import { perSetSummary } from '../lib/actual';
import WorkoutEditor from '../components/edit/WorkoutEditor';
import ActionMenu from '../components/edit/ActionMenu';
import WorkoutOrderDialog from '../components/edit/WorkoutOrderDialog';
import { applyWorkoutOrder } from '../lib/workout-order';
import { captureWorkoutAnchor, restoreWorkoutAnchor, type WorkoutAnchor } from '../lib/scroll-anchor';
import ItemCard, {
  plannedSetsCount,
  restLabel,
  stripNumbering,
  weightLabel,
} from '../components/train/ItemCard';
import { parseRestSeconds } from '../lib/rest-timer';
import { timedSetPlan } from '../lib/timed-sets';
import VideoLink from '../components/train/VideoLink';
import {
  CheckIcon,
  ChevronIcon,
  FlameIcon,
  HeartPulseIcon,
  VideoIcon,
  XIcon,
} from '../components/train/icons';

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
    exerciseById,
    itemKind,
    lastResultBefore,
    saveWorkout,
    requestRestTimer,
  } = useApp();
  const { t } = useT();

  /* Если есть начатая тренировка («идёт»), без явно открытой показываем её,
     а не просто последнюю по дате: старт не должен теряться при перезаходе */
  const activeWorkout =
    workouts.find((x) => x.status === 'planned' && !!x.startedAt) ?? null;
  const w = !openWorkoutId && activeWorkout ? activeWorkout : currentWorkout;
  const isActive = !!w && w.status === 'planned' && !!w.startedAt;

  const [editing, setEditing] = useState<{ workoutId: string; itemId?: string } | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  const orderAnchorRef = useRef<WorkoutAnchor | null>(null);
  const restoreAnchorRef = useRef<WorkoutAnchor | null>(null);
  const viewAnchorRef = useRef<WorkoutAnchor | null>(null);
  const returnCompactRef = useRef(false);
  const openedItemsRef = useRef<Record<string, boolean>>({});

  const beginEdit = (itemId?: string, fromCompact = false) => {
    if (!w) return;
    returnCompactRef.current = fromCompact;
    if (fromCompact) setExpandedMap((current) => ({ ...current, [w.id]: true }));
    const anchor = captureWorkoutAnchor(itemId);
    viewAnchorRef.current = anchor;
    restoreAnchorRef.current = anchor;
    document.querySelectorAll<HTMLElement>('[data-workout-item][data-item-expanded]').forEach((card) => {
      openedItemsRef.current[card.dataset.workoutItem!] = card.dataset.itemExpanded === 'true';
    });
    // Pin the identity without adding history or treating editing as navigation.
    navigate('train', w.id, { preserveScroll: true, replace: true });
    setEditing({ workoutId: w.id, itemId });
  };
  const endEdit = () => {
    const current = captureWorkoutAnchor(editing?.itemId);
    restoreAnchorRef.current = current.itemId ? current : viewAnchorRef.current;
    if (returnCompactRef.current && w) setExpandedMap((map) => ({ ...map, [w.id]: false }));
    returnCompactRef.current = false;
    setEditing(null);
  };
  useLayoutEffect(() => {
    if (!restoreAnchorRef.current) return;
    const anchor = restoreAnchorRef.current;
    restoreAnchorRef.current = null;
    restoreWorkoutAnchor(anchor);
    // The browser may adjust focus/scroll anchoring after the DOM replacement.
    const frame = requestAnimationFrame(() => restoreWorkoutAnchor(anchor));
    return () => cancelAnimationFrame(frame);
  }, [editing, reordering, w]);
  useEffect(() => {
    if (editing && editing.workoutId !== w?.id) setEditing(null);
  }, [editing, w?.id]);

  // Свёрнутость блоков помним на время сессии, отдельно для каждой тренировки
  const [warmupOpenMap, setWarmupOpenMap] = useState<Record<string, boolean>>({});
  const [notesOpenMap, setNotesOpenMap] = useState<Record<string, boolean>>({});
  /* Завершённая тренировка «закрыта»: отметки упражнений, разминки и ползунок
     усталости не реагируют, пока не открыть замок внизу (на время сессии). */
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>({});
  /* «Развернуть — посмотреть подробно» на компактной карточке (на время сессии) */
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [warmupPop, setWarmupPop] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // The detail screen uses visible navigation and actions, without horizontal gestures.
  const wRef = useRef<Workout | null>(w);
  useEffect(() => { wRef.current = w; }, [w]);
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => setClockTick((tick) => tick + 1), 30_000);
    return () => window.clearInterval(interval);
  }, [isActive, w?.id]);

  if (loading) return null;

  if (!w) {
    return <EmptyState onEdit={() => navigate('create')} onMenu={() => navigate('menu')} />;
  }

  const index = workouts.findIndex((x) => x.id === w.id);
  const prev = index > 0 ? workouts[index - 1] : null;
  const next = index >= 0 && index < workouts.length - 1 ? workouts[index + 1] : null;

  const saveItem = (itemId: string, patch: Partial<WorkoutItem>) => {
    const cur = wRef.current ?? w;
    saveWorkout({
      ...cur,
      items: cur.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    });
  };

  const sortedItems = [...w.items].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  /* Разминочные упражнения собираются в общую карточку «Разминка», кардио —
     отдельным блоком с сердечком (не считается упражнением), обычные —
     нумерованными карточками */
  const warmupItems = sortedItems.filter((it) => itemKind(it) === 'warmup');
  const mainItems = sortedItems.filter((it) => itemKind(it) === 'main');
  const cardioItems = sortedItems.filter((it) => itemKind(it) === 'cardio');
  /* Пункты рабочего списка: упражнения + кардио (кардио в конце) */
  const flowItems = [...mainItems, ...cardioItems];

  const hasWarmup = w.warmup.length > 0 || warmupItems.length > 0 || !!w.warmupVideoUrl;
  const warmupCount = w.warmup.length + warmupItems.length;

  const warmupOpen = warmupOpenMap[w.id] ?? (w.status === 'planned' && !w.warmupDone);
  const notesOpen = notesOpenMap[w.id] ?? false;
  const workoutLocked = w.status === 'done' && !unlockedMap[w.id];

  /* Три состояния тренировки: компактная карточка / «идёт» / подробный вид */
  const wState: 'active' | 'planned' | 'done' =
    w.status === 'done' ? 'done' : w.startedAt ? 'active' : 'planned';
  const expanded = expandedMap[w.id] ?? false;

  const todoItems = flowItems.filter((it) => !it.done && !it.skipped);
  const doneItems = flowItems.filter((it) => it.done);
  const skippedItems = flowItems.filter((it) => !it.done && it.skipped);
  const movedCount = doneItems.length + skippedItems.length;
  const numOf = (it: WorkoutItem) => mainItems.findIndex((x) => x.id === it.id) + 1;
  const todoMains = todoItems.filter((it) => itemKind(it) === 'main');
  const todoCardio = todoItems.filter((it) => itemKind(it) === 'cardio');

  /* Разминка и кардио в рабочем режиме — тоже пункты списка: отметил —
     уехали в «Выполнено» и посчитались в прогрессе */
  const workTotal = flowItems.length + (hasWarmup ? 1 : 0);
  const workMoved = movedCount + (hasWarmup && w.warmupDone ? 1 : 0);
  const workDone = doneItems.length + (hasWarmup && w.warmupDone ? 1 : 0);

  const elapsedMin = (() => {
    if (!w.startedAt) return 0;
    const ms = Date.now() - Date.parse(w.startedAt);
    return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : 0;
  })();

  /* Плавная смена вида (компакт ⇄ подробный ⇄ «идёт»): мягкий кроссфейд через
     View Transitions, где браузер умеет; иначе — мгновенно, как раньше */
  const switchView = (apply: () => void) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply();
      return;
    }
    doc.startViewTransition(() => {
      flushSync(apply);
    });
  };

  const startWorkout = () =>
    switchView(() => saveWorkout({ ...w, startedAt: new Date().toISOString() }));
  const cancelStart = () => switchView(() => saveWorkout({ ...w, startedAt: null }));

  /* «Завершить» в режиме «идёт»: неотмеченное — с подтверждением в пропуск */
  const finishActive = () => {
    let items = w.items;
    if (todoItems.length > 0) {
      const ok = window.confirm(t.train.finishConfirm(t.counted.exercises(todoItems.length)));
      if (!ok) return;
      const ids = new Set(todoItems.map((r) => r.id));
      items = w.items.map((i) => (ids.has(i.id) ? { ...i, skipped: true } : i));
    }
    switchView(() => {
      saveWorkout({ ...w, items, status: 'done' });
      setUnlockedMap((m) => ({ ...m, [w.id]: false }));
      setCelebrate(true);
    });
    window.setTimeout(() => setCelebrate(false), 1200);
  };

  const requestRest = (item: WorkoutItem, autostart = false) =>
    requestRestTimer(item.id, parseRestSeconds(item.rest), autostart, { kind: 'rest', itemId: item.id, workoutId: w.id });
  const requestSet = (item: WorkoutItem) => {
    const plan = timedSetPlan(item);
    const setIndex = item.setsDone ?? 0;
    if (!plan || plan[setIndex] == null) return;
    requestRestTimer(item.id, plan[setIndex], false, {
      kind: 'set', itemId: item.id, workoutId: w.id, setIndex, totalSets: plan.length,
      exerciseName: exerciseById(item.exerciseId)?.name ?? item.nameRaw,
      restSeconds: parseRestSeconds(item.rest),
    });
  };

  /* Разминка: шапка как у карточки упражнения — видео и «выполнено».
     Секция общая для режима «идёт» и подробного вида */
  const warmupSection = hasWarmup && (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <button
          onClick={() => setWarmupOpenMap((m) => ({ ...m, [w.id]: !warmupOpen }))}
          aria-expanded={warmupOpen}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
        >
          {/* огонёк — как у строки разминки в компактной карточке */}
          <span aria-hidden="true" className="text-muted">
            <FlameIcon size={15} />
          </span>
          <span
            className={
              'text-sm font-semibold uppercase tracking-wide ' +
              (w.warmupDone ? 'text-muted' : '')
            }
          >
            {t.train.warmup}
          </span>
          {warmupCount > 0 && <span className="text-sm text-muted">{warmupCount}</span>}
          <span className="text-muted">
            <ChevronIcon open={warmupOpen} size={18} />
          </span>
        </button>
        {w.warmupVideoUrl && (
          <a
            href={w.warmupVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.train.warmupVideo}
            title={t.train.warmupVideo}
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
          aria-label={w.warmupDone ? t.train.warmupUndo : t.train.warmupDone}
          title={workoutLocked ? t.train.lockedHint : undefined}
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
      {warmupOpen && warmupCount > 0 && (
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
          {/* Разминочные упражнения из библиотеки — в той же ленте */}
          {warmupItems.map((it, i) => {
            const ex = it.exerciseId ? exerciseById(it.exerciseId) : undefined;
            const name = t.catalog.exercise(ex?.name ?? it.nameRaw) || t.item.fallbackName;
            const video = it.videoUrl ?? ex?.videoUrl ?? null;
            return (
              <li key={it.id} className="flex items-start gap-2 text-[15px] leading-snug">
                <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-chip px-1 text-[11px] font-semibold tabular-nums text-muted">
                  {w.warmup.length + i + 1}
                </span>
                <span className="min-w-0 break-words">
                  {name}
                  {it.setsReps?.raw && <> — {it.setsReps.raw}</>}
                  {video && <VideoLink href={video} className="ml-1.5" />}
                  {(it.subNotes ?? []).map((sn, j) => (
                    <span key={j} className="mt-0.5 block text-[13px] leading-snug text-muted">
                      {sn.text}
                      {sn.videoUrl && <VideoLink href={sn.videoUrl} className="ml-1.5" />}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const beginOrder = (itemId?: string) => {
    orderAnchorRef.current = captureWorkoutAnchor(itemId);
    setReordering(itemId ?? '');
  };
  const endOrder = () => {
    restoreAnchorRef.current = orderAnchorRef.current;
    setReordering(null);
  };
  const removeItem = (item: WorkoutItem) => {
    const name = t.catalog.exercise(exerciseById(item.exerciseId)?.name ?? stripNumbering(item.nameRaw));
    if (!window.confirm(t.editor.removeItemConfirm(name))) return;
    const current = wRef.current ?? w;
    const index = current.items.findIndex((entry) => entry.id === item.id);
    const neighbor = current.items[index + 1] ?? current.items[index - 1];
    restoreAnchorRef.current = captureWorkoutAnchor(neighbor?.id);
    saveWorkout({ ...current, items: current.items.filter((entry) => entry.id !== item.id)
      .map((entry, i) => ({ ...entry, order: i + 1 })) });
  };

  /* Строка в «Выполнено» для упражнения: имя + сводка (частичные подходы —
     «2 из 3 подх.», пропуск — «пропущено», иначе — обычная нотация) */
  const doneRowFor = (it: WorkoutItem, skippedRow: boolean) => {
    const ex = it.exerciseId ? exerciseById(it.exerciseId) : undefined;
    const video = it.videoUrl ?? ex?.videoUrl;
    const nm =
      t.catalog.exercise(ex?.name ?? stripNumbering(it.nameRaw ?? '')) || t.item.fallbackName;
    const planned = plannedSetsCount(it);
    const sd = it.setsDone ?? 0;
    const summary = skippedRow
      ? t.train.skippedLabel
      : sd > 0 && sd < planned
        ? t.item.setsDoneOf(sd, planned)
        : compactSummary(it, exerciseKind(ex), t);
    if (editing?.itemId === it.id) return <WorkoutEditor key={it.id} workout={w} itemId={it.id} onClose={endEdit} />;
    return (
      <div key={it.id} data-workout-item={it.id} className="flex items-center gap-1 rounded-xl border border-border bg-card pr-1">
        <DoneRow name={nm} summary={summary} skippedRow={skippedRow}
          onRestore={() => saveItem(it.id, { done: false, skipped: false })} />
        {!editing && <ActionMenu label={`${t.actions.exerciseActions}: ${nm}`} actions={[
          ...(video ? [{ label: t.item.techVideo, href: video }] : []),
          { label: t.actions.editWorkout, run: () => beginEdit(it.id) },
          { label: t.actions.moveExercise, run: () => beginOrder(it.id) },
          { label: t.actions.removeFromWorkout, run: () => removeItem(it), danger: true },
        ]} />}
      </div>
    );
  };

  /* Рабочие списки — общие для режима «идёт» и правки завершённой после
     открытия замка: сверху «to-do», внизу «Выполнено», разминка — пункт списка */
  const renderItem = (item: WorkoutItem, num: number, locked: boolean, active = false) =>
    editing?.itemId === item.id ? (
      <WorkoutEditor key={item.id} workout={w} itemId={item.id} onClose={endEdit} />
    ) : (
      <ItemCard key={item.id} item={item} num={num} locked={locked} active={active}
        initialOpen={openedItemsRef.current[item.id] ?? false}
        exercise={item.exerciseId ? exerciseById(item.exerciseId) : undefined}
        last={item.exerciseId ? lastResultBefore(item.exerciseId, w.date, w.id) : null}
        onChange={(patch) => saveItem(item.id, patch)} onRest={requestRest} onTime={requestSet}
        onEdit={editing ? undefined : () => beginEdit(item.id)}
        onMove={editing ? undefined : () => beginOrder(item.id)}
        onRemove={editing ? undefined : () => removeItem(item)} />
    );

  const workLists = (
    <>
      {hasWarmup && !w.warmupDone && warmupSection}

      {(todoMains.length > 0 || flowItems.length === 0) && (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">
            {t.train.exercises}
          </h2>
          {flowItems.length === 0 && (
            <p className="rounded-2xl border border-border bg-card p-4 text-muted">
              {t.train.noItems}
            </p>
          )}
          {todoMains.map((it) => renderItem(it, numOf(it), false, true))}
        </section>
      )}

      {todoCardio.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">
            {t.train.cardio}
          </h2>
          {todoCardio.map((it) => renderItem(it, 0, false, true))}
        </section>
      )}

      {workMoved > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-baseline gap-2 px-1 text-sm font-semibold uppercase tracking-wide text-ok-text">
            {t.train.doneBlock}
            <span className="normal-case tracking-normal text-muted">
              {t.train.ofCount(workDone, workTotal)}
            </span>
          </h2>
          {hasWarmup && w.warmupDone && (
            <DoneRow
              name={t.train.warmup}
              summary={warmupCount > 0 ? String(warmupCount) : ''}
              skippedRow={false}
              onRestore={() => saveWorkout({ ...w, warmupDone: false })}
            />
          )}
          {doneItems.map((it) => doneRowFor(it, false))}
          {skippedItems.map((it) => doneRowFor(it, true))}
        </section>
      )}
    </>
  );

  /* Заметки тренера — тоже общие для «идёт» и подробного вида */
  const notesSection = w.notes.trim() !== '' && (
    <section className="rounded-2xl border border-border bg-card p-4">
      <button
        onClick={() => setNotesOpenMap((m) => ({ ...m, [w.id]: !notesOpen }))}
        aria-expanded={notesOpen}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t.train.trainerNotes}
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
  );

  return (
    <div style={{ overflowAnchor: 'none' }} className="touch-pan-y space-y-4">
      {/* Дата и явная навигация между тренировками. */}
      <TopBlock
        w={w}
        prev={editing ? null : prev}
        next={editing ? null : next}
        onOpen={(id) => navigate('train', id)}
      />
      {!editing && <CycleSummary date={w.date} />}
      <div key={w.id} className="space-y-4">

      {!editing && (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => beginOrder()}
            className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-muted">{t.actions.reorder}</button>
          <button type="button" onClick={() => beginEdit()}
            className="min-h-11 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-accent">
            {w.status === 'done' ? t.actions.editRecord : t.actions.editWorkout}
          </button>
        </div>
      )}

      {editing && !editing.itemId ? (
        <WorkoutEditor key={w.id} workout={w} onClose={endEdit} />
      ) : wState === 'active' ? (
        <>
          {/* Шапка режима «идёт»: минуты с начала и прогресс по упражнениям */}
          <section className="rounded-2xl bg-accent-soft px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-accent">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
                {t.status.active}
              </span>
              <span className="text-[12px] font-bold tabular-nums text-accent">
                {elapsedMin} {t.min}
              </span>
              <span className="ml-auto text-[12px] font-bold tabular-nums">
                {t.train.ofCount(workMoved, workTotal)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent/20">
              <div
                className="h-full origin-left rounded-full bg-accent transition-transform duration-300"
                style={{
                  transform: `scaleX(${workTotal ? workMoved / workTotal : 0})`,
                }}
              />
            </div>
          </section>

          {workLists}

          {/* Усталость + завершение */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <FatigueBlock
              w={w}
              workoutLocked={false}
              onSave={(f) => saveWorkout({ ...w, fatigue: f })}
            />
            <div className="mt-4">
              <button
                disabled={!!editing}
                onClick={finishActive}
                className="w-full rounded-xl bg-accent px-4 py-2.5 text-lg font-bold text-accent-fg"
              >
                {t.train.finish}
              </button>
            </div>
          </section>

          {/* Случайно нажала «Начать» — можно вернуть карточку-план */}
          <button
            type="button"
            disabled={!!editing}
            onClick={cancelStart}
            className="mx-auto block text-sm text-muted underline decoration-dotted underline-offset-2"
          >
            {t.train.cancelStart}
          </button>

          {notesSection}
        </>
      ) : !expanded ? (
        <CompactWorkoutCard
          w={w}
          celebrate={celebrate}
          onStart={startWorkout}
          onEdit={(item) => beginEdit(item.id, true)}
          onMove={(item) => beginOrder(item.id)}
          onRemove={removeItem}
          onExpand={() => switchView(() => setExpandedMap((m) => ({ ...m, [w.id]: true })))}
        />
      ) : (
        <>
          {/* Подробный вид: всё как раньше, сверху — путь назад к карточке */}
          <button
            type="button"
            disabled={!!editing}
            onClick={() => switchView(() => setExpandedMap((m) => ({ ...m, [w.id]: false })))}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted"
          >
            <ChevronIcon open size={16} />
            {t.train.collapseView}
          </button>

          {wState === 'done' && !workoutLocked ? (
            /* Замок открыт — правим той же «to-do»-логикой, что и в режиме
               «идёт»: снятая галочка возвращает упражнение наверх */
            workLists
          ) : (
            <>
              {warmupSection}

              {/* Упражнения */}
              <section className="space-y-3">
                <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">
                  {t.train.exercises}
                </h2>
                {mainItems.length === 0 && (
                  <p className="rounded-2xl border border-border bg-card p-4 text-muted">
                    {t.train.noItems}
                  </p>
                )}
                {mainItems.map((it, i) => renderItem(it, i + 1, workoutLocked))}
              </section>

              {/* Кардио — свой блок с сердечком, упражнением не считается */}
              {cardioItems.length > 0 && (
                <section className="space-y-3">
                  <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">
                    {t.train.cardio}
                  </h2>
                  {cardioItems.map((it) => renderItem(it, 0, workoutLocked))}
                </section>
              )}
            </>
          )}

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
                  disabled={!!editing}
                  onClick={() => {
                    saveWorkout({ ...w, status: 'done' });
                    // завершение всегда закрывает замок заново
                    setUnlockedMap((m) => ({ ...m, [w.id]: false }));
                    setCelebrate(true);
                    window.setTimeout(() => setCelebrate(false), 1200);
                  }}
                  className="w-full rounded-xl bg-accent px-4 py-2.5 text-lg font-bold text-accent-fg"
                >
                  {t.train.finish}
                </button>
              ) : (
                /* Общий замок: «Завершить» закрывает отметки всей тренировки;
                   открытие/закрытие меняет вид на рабочие списки — с кроссфейдом */
                <button
                  disabled={!!editing}
                  onClick={() =>
                    switchView(() => setUnlockedMap((m) => ({ ...m, [w.id]: workoutLocked })))
                  }
                  aria-pressed={!workoutLocked}
                  className={
                    'flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ' +
                    (workoutLocked
                      ? 'border-border bg-bg text-muted'
                      : 'border-accent/50 bg-accent-soft text-accent')
                  }
                >
                  <LockIcon open={!workoutLocked} />
                  {workoutLocked ? t.train.locked : t.train.unlocked}
                </button>
              )}
            </div>
          </section>

          {/* «Вернуть в запланированные» — отдельно, появляется после разблокировки */}
          {w.status === 'done' && !workoutLocked && (
            <button
              disabled={!!editing}
              onClick={() => saveWorkout({ ...w, status: 'planned' })}
              className="anim-rise w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted"
            >
              {t.train.backToPlanned}
            </button>
          )}

          {notesSection}

        </>
      )}
      </div>

      {/* Таймер остаётся на месте при редактировании и перестановке */}
      {reordering !== null && <WorkoutOrderDialog workout={w} selectedId={reordering || undefined}
        onClose={endOrder} onSave={(ids) => {
          const current = wRef.current ?? w;
          saveWorkout({ ...current, items: applyWorkoutOrder(current.items, ids) });
          endOrder();
        }} />}
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
  const { t } = useT();
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
              {t.status.done}
            </span>
          ) : w.startedAt ? (
            /* режим «идёт» — единственный залитый петролью бейдж */
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-fg">
              {t.status.active}
            </span>
          ) : (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
              {t.status.planned}
            </span>
          )}
          {w.type && (
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted">
              {t.catalog.workoutType(w.type)}
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
            {t.train.toLatest}
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
  const { t } = useT();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? t.train.prevWorkout : t.train.nextWorkout}
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

/* --- Компактная карточка: план и итог одним взглядом ----------------------- */

/** Строка «3х10 · 37.5 кг» для компактного списка: факт вытесняет план */
function compactSummary(it: WorkoutItem, kind: ExerciseKind, dict: Dict): string {
  if (kind === 'cardio') {
    const parts: string[] = [];
    if (it.duration) parts.push(restLabel(it.duration, dict));
    if (it.pulseZone) parts.push(it.pulseZone);
    return parts.join(' · ');
  }
  const ps = perSetSummary(it.actual);
  const sr = ps?.reps
    ? `${ps.count}х${ps.reps}`
    : it.actual?.sets != null && it.actual?.reps != null
      ? `${it.actual.sets}х${it.actual.reps}`
      : (it.setsReps?.raw ?? '');
  const wt = ps?.weights
    ? weightLabel(ps.weights, dict)
    : it.actual?.weight != null
      ? weightLabel(String(it.actual.weight), dict)
      : it.weight?.raw
        ? weightLabel(it.weight.raw, dict)
        : '';
  return [sr, wt].filter(Boolean).join(' · ');
}

function CompactWorkoutCard({ w, celebrate, onStart, onExpand, onEdit, onMove, onRemove }: {
  w: Workout;
  celebrate: boolean;
  onStart: () => void;
  onExpand: () => void;
  onEdit: (item: WorkoutItem) => void;
  onMove: (item: WorkoutItem) => void;
  onRemove: (item: WorkoutItem) => void;
}) {
  const { exerciseById, itemKind } = useApp();
  const { t } = useT();
  const sorted = [...w.items].sort((a, b) => a.order - b.order);
  const warmupCount = w.warmup.length + sorted.filter((item) => itemKind(item) === 'warmup').length;
  const items = [...sorted.filter((item) => itemKind(item) === 'main'), ...sorted.filter((item) => itemKind(item) === 'cardio')];
  return <>
    <section className="relative rounded-2xl border border-border bg-card p-4">
      {celebrate && <ConfettiBurst />}
      {warmupCount > 0 && <div className="mb-1 flex items-center gap-2.5 border-b border-border/60 pb-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-chip text-muted" aria-hidden="true"><FlameIcon size={13} /></span>
        <span className="text-[15px] font-semibold text-muted">{t.train.warmup}</span>
        <span className="ml-auto text-xs font-semibold text-muted">{warmupCount}</span>
      </div>}
      {!items.length && <p className="text-muted">{t.train.noItems}</p>}
      <ul className="divide-y divide-border/60">
        {items.map((item) => {
          const kind = itemKind(item);
          const exercise = exerciseById(item.exerciseId);
          const name = t.catalog.exercise(exercise?.name ?? stripNumbering(item.nameRaw)) || t.item.fallbackName;
          const video = item.videoUrl ?? exercise?.videoUrl;
          const skipped = !!item.skipped && !item.done;
          const summary = compactSummary(item, kind, t);
          return <li key={item.id} data-workout-item={item.id} className="flex min-h-14 items-center gap-2.5 py-2">
            <div className={'min-w-0 flex-1 ' + (skipped ? 'text-muted line-through opacity-60' : '')}>
              {skipped && <span className="sr-only">{t.train.skippedLabel}: </span>}
              <span title={name} className="block break-words text-base font-semibold">{name}</span>
              {summary && <span className="mt-0.5 block break-words text-sm tabular-nums text-muted">{summary}</span>}
            </div>
            <ActionMenu label={`${t.actions.exerciseActions}: ${name}`} actions={[
              ...(video ? [{ label: t.item.techVideo, href: video }] : []),
              { label: t.actions.editWorkout, run: () => onEdit(item) },
              { label: t.actions.moveExercise, run: () => onMove(item) },
              { label: t.actions.removeFromWorkout, run: () => onRemove(item), danger: true },
            ]} />
          </li>;
        })}
      </ul>
      {w.fatigue != null && <p className="mt-3 border-t border-border/60 pt-3 text-sm text-muted">{t.fatigueN10(w.fatigue)}</p>}
    </section>
    {w.status === 'planned' && <button type="button" onClick={onStart}
      className="min-h-11 w-full rounded-xl bg-accent px-4 py-2.5 text-lg font-bold text-accent-fg">{t.train.start}</button>}
    <button type="button" onClick={onExpand}
      className="min-h-11 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted">{t.train.expandView}</button>
  </>;
}

function DoneRow({
  name,
  summary,
  skippedRow,
  onRestore,
}: {
  name: string;
  summary: string;
  skippedRow: boolean;
  onRestore: () => void;
}) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onRestore}
      title={t.train.returnToList}
      aria-label={`${name} — ${t.train.returnToList}`}
      className="anim-rise flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left"
    >
      <span
        aria-hidden="true"
        className={
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ' +
          (skippedRow ? 'bg-chip text-muted' : 'bg-ok text-ok-fg')
        }
      >
        {skippedRow ? <XIcon size={13} /> : <CheckIcon size={13} />}
      </span>
      <span
        className={
          'min-w-0 flex-1 truncate text-[15px] ' +
          (skippedRow ? 'font-medium text-muted line-through opacity-60' : 'font-bold')
        }
      >
        {name}
      </span>
      {summary && (
        <span className="ml-auto max-w-[45%] shrink-0 truncate text-xs font-semibold tabular-nums text-muted">
          {summary}
        </span>
      )}
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
  const { t } = useT();
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
          {t.train.fatigueTitle}
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
          aria-label={t.train.fatigueAria}
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
          <span>{t.train.fatigueLo}</span>
          <span>{t.train.fatigueHi}</span>
        </div>
      </div>

      {!marked && !locked && (
        <p className="mt-2 text-sm text-muted">{t.train.fatigueHint}</p>
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
          {t.train.fatigueClear}
        </button>
      )}
    </>
  );
}

/* --- Пустое состояние ------------------------------------------------------ */

function EmptyState({ onEdit, onMenu }: { onEdit: () => void; onMenu: () => void }) {
  const { t } = useT();
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
        <p className="text-lg font-semibold">{t.train.emptyTitle}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-muted">{t.train.emptyBody}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={onEdit}
          className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg"
        >
          {t.train.emptyEnable}
        </button>
        <button
          onClick={onMenu}
          className="rounded-xl border border-border bg-card px-4 py-2.5 font-medium"
        >
          {t.train.emptyMenu}
        </button>
      </div>
    </div>
  );
}
