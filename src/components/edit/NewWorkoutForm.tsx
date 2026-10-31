import { useMemo, useState } from 'react';
import type { Workout } from '../../types';
import { useApp } from '../../store';
import { useT } from '../../i18n';
import { fmtDateShort, fmtWeekday, todayISO } from '../../lib/dates';
import { workoutIdForDate } from '../../lib/ids';
import { newWorkoutDraft } from '../../lib/workout-draft';
import WorkoutEditor from './WorkoutEditor';

/** Creation stays a draft until the editor's explicit Save. */
export default function NewWorkoutForm() {
  const { workouts, navigate, goBack, canGoBack, itemKind } = useApp();
  const { t } = useT();
  const [draft, setDraft] = useState<Workout | null>(null);
  const [repeat, setRepeat] = useState(false);
  const sources = useMemo(() => [...workouts].reverse(), [workouts]);
  const close = () => canGoBack ? goBack() : navigate('home');
  const begin = (source: Workout | null) => {
    const date = todayISO();
    setDraft(newWorkoutDraft(workoutIdForDate(date, workouts.map((workout) => workout.id)), date, source));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  };

  if (draft) {
    return <WorkoutEditor workout={draft} isNew onClose={close}
      onSaved={(workout) => navigate('train', workout.id, { replace: true })} />;
  }

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-bold">{t.form.newWorkout}</h2>
      <p className="text-muted">{t.actions.newWorkoutHint}</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => begin(null)}
          className="min-h-14 rounded-xl border border-border bg-card px-4 py-3 font-semibold">
          {t.actions.fromScratch}
        </button>
        <button type="button" onClick={() => setRepeat(true)} disabled={sources.length === 0}
          className="min-h-14 rounded-xl border border-border bg-card px-4 py-3 font-semibold disabled:opacity-40">
          {t.actions.repeatWorkout}
        </button>
      </div>
      {repeat && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t.actions.repeatHint}</p>
          <ul className="space-y-2">
            {sources.map((workout) => (
              <li key={workout.id}>
                <button type="button" onClick={() => begin(workout)} aria-label={t.actions.copyWorkoutAria(fmtDateShort(workout.date))}
                  className="min-h-14 w-full rounded-xl border border-border bg-card px-4 py-3 text-left">
                  <span className="flex items-center justify-between gap-3 font-semibold"><span>{fmtDateShort(workout.date)}, {fmtWeekday(workout.date)}</span><span aria-hidden="true" className="text-muted">›</span></span>
                  <span className="mt-1 block text-sm text-muted">
                    {t.counted.exercises(workout.items.filter((item) => itemKind(item) === 'main').length)}
                    {workout.type && ` · ${t.catalog.workoutType(workout.type)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={close} className="min-h-11 rounded-xl px-4 py-2.5 text-muted">{t.cancel}</button>
    </section>
  );
}
