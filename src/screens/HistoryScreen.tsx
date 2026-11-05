import { useEffect, useMemo, useState } from 'react';
import type { Workout } from '../types';
import { useApp } from '../store';
import { useT } from '../i18n';
import { fmtDateShort, fmtWeekday, todayISO } from '../lib/dates';
import MonthCalendar from '../components/history/MonthCalendar';
import { BarbellIcon } from '../components/train/icons';
import { FatigueFace, fatigueColor } from '../components/FatigueIndicator';
import { Chip, IconCheck, IconComment, IconPlus } from '../components/edit/ui';

const memory = { scroll: 0, month: todayISO().slice(0, 7), date: null as string | null };

export default function HistoryScreen() {
  const { workouts, navigate } = useApp();
  const { t } = useT();
  const [month, setMonth] = useState(memory.month);
  const [date, setDate] = useState(memory.date);
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo({ top: memory.scroll, behavior: 'instant' }));
    const remember = () => { memory.scroll = window.scrollY; };
    window.addEventListener('scroll', remember, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', remember); };
  }, []);
  const open = (workout: Workout) => {
    memory.scroll = window.scrollY;
    navigate('train', workout.id);
  };
  const groups = useMemo(() => {
    if (date) return [{ title: fmtDateShort(date), workouts: workouts.filter((workout) => workout.date === date) }];
    const active = workouts.filter((workout) => workout.status === 'planned' && workout.startedAt);
    const planned = workouts.filter((workout) => workout.status === 'planned' && !workout.startedAt);
    const done = [...workouts].reverse().filter((workout) => workout.status === 'done');
    return [
      { title: t.actions.currentWorkout, workouts: active },
      { title: t.actions.plannedWorkouts, workouts: planned },
      { title: t.actions.pastWorkouts, workouts: done },
    ].filter((group) => group.workouts.length > 0);
  }, [workouts, date, t]);
  return (
    <div className="space-y-4">
      <div className="sticky top-[calc(60px+env(safe-area-inset-top))] z-10 -mx-1 flex items-center gap-3 rounded-xl bg-bg p-1">
        <button type="button" aria-label={t.actions.createWorkout}
          onClick={() => { memory.scroll = window.scrollY; navigate('create'); }}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 font-semibold text-accent-fg">
          <IconPlus size={20} /><span>{t.actions.addWorkout}</span>
        </button>
      </div>
      <MonthCalendar month={month} selectedDate={date}
        onMonthChange={(value) => { memory.month = value; memory.date = null; setMonth(value); setDate(null); }}
        onSelectDate={(value) => { memory.date = date === value ? null : value; setDate(memory.date); }} />
      {date && !workouts.some(w => w.date === date) && <p className="text-sm text-muted">{t.cycle.noWorkout}</p>}
      {date && <button type="button" onClick={() => { memory.date = null; setDate(null); }}
        className="min-h-11 rounded-lg px-2 text-sm font-semibold text-accent">{t.actions.allWorkouts}</button>}
      {workouts.length === 0 && <p className="py-12 text-center text-muted">{t.hist.emptyNoEdit}</p>}
      {groups.map((group) => <section key={group.title} className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-muted">{group.title}</h2>
        <ul className="space-y-2">{group.workouts.map((workout) => <WorkoutRow key={workout.id} w={workout} onOpen={open} />)}</ul>
      </section>)}
    </div>
  );
}

function WorkoutRow({ w, onOpen }: { w: Workout; onOpen: (workout: Workout) => void }) {
  const { itemKind } = useApp();
  const { t } = useT();
  const hasComment = w.items.some((it) => it.myComment && it.myComment.trim() !== '');
  // разминка и кардио — не упражнения, в счётчик не входят
  const exerciseCount = w.items.filter((it) => itemKind(it) === 'main').length;

  return (
    <li className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => onOpen(w)}
        className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 text-left"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-lg font-bold leading-tight">{fmtDateShort(w.date)}</span>
          <span className="text-muted">{fmtWeekday(w.date)}</span>
          {w.status === 'planned' && <span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent">{w.startedAt ? t.status.active : w.date < todayISO() ? t.actions.unfinished : t.status.planned}</span>}
          {w.status === 'done' && (
            <span className="text-ok" title={t.hist.doneTitle}>
              <IconCheck size={16} />
            </span>
          )}
          {hasComment && (
            <span className="text-muted" title={t.hist.hasComments}>
              <IconComment size={15} />
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {w.type && <Chip>{t.catalog.workoutType(w.type)}</Chip>}
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-muted" title={t.counted.exercises(exerciseCount)}><BarbellIcon /><span aria-hidden="true">{exerciseCount}</span><span className="sr-only">{t.counted.exercises(exerciseCount)}</span></span>
          {w.fatigue != null && <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums" title={t.fatigueN10(w.fatigue)}><span style={{ color: `color-mix(in oklab, ${fatigueColor(w.fatigue)} 55%, var(--fg))` }}><FatigueFace level={w.fatigue} size={19} /></span><span aria-hidden="true">{w.fatigue}</span><span className="sr-only">{t.fatigueN10(w.fatigue)}</span></span>}
        </div>
      </button>

    </li>
  );
}
