import type { CycleMark } from '../lib/cycle';
import type { Workout } from '../types';

/** Phase fill, selection ring and workout dot have independent, fixed bounds. */
export default function CalendarDate({ day, mark, today = false, selected = false, workout, workoutFocus = false, active = false }: {
  day: number;
  mark: CycleMark | null;
  today?: boolean;
  selected?: boolean;
  workout?: Workout['status'];
  workoutFocus?: boolean;
  active?: boolean;
}) {
  return <span aria-hidden="true" className={"calendar-day" + (workoutFocus ? " calendar-day--workout-focus" : "")}>
    <span className="calendar-day__disc" data-mark={workoutFocus ? undefined : mark ?? undefined} data-workout={workoutFocus ? (active ? 'active' : workout) : undefined} data-today={today || undefined} data-selected={selected || undefined}>
      <span className="calendar-day__number">{day}</span>
    </span>
    {workoutFocus && mark && <CalendarCycleMark mark={mark} />}
    {!workoutFocus && workout && <span className="calendar-day__workout" data-status={workout} />}
  </span>;
}

/** Shared by date cells and their legend so the symbols always match. */
export function CalendarCycleMark({ mark }: { mark: CycleMark }) {
  return <svg aria-hidden="true" className="calendar-cycle-mark" data-mark={mark} width="20" height="8" viewBox="0 0 20 10" fill="none">
    {mark === 'ovulation' ? <>
      <ellipse className="calendar-cycle-mark__oval" cx="10" cy="5" rx="6" ry="4" strokeWidth="1.5" />
      <circle cx="10" cy="5" r="1.5" fill="currentColor" />
    </> : <path d="M1 5c1.5-3 3-3 4.5 0s3 3 4.5 0s3-3 4.5 0s3 3 4.5 0"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={mark === 'periodEstimate' ? '2.5 2.5' : undefined} />}
  </svg>;
}

export function CycleSwatch({ mark }: { mark: CycleMark }) {
  return <span aria-hidden="true" className="cycle-swatch" data-mark={mark} />;
}
