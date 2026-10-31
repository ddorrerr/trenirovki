import type { CycleMark } from '../lib/cycle';
import type { Workout } from '../types';

/** Phase fill, selection ring and workout dot have independent, fixed bounds. */
export default function CalendarDate({ day, mark, today = false, selected = false, workout }: {
  day: number;
  mark: CycleMark | null;
  today?: boolean;
  selected?: boolean;
  workout?: Workout['status'];
}) {
  return <span aria-hidden="true" className="calendar-day">
    <span className="calendar-day__disc" data-mark={mark ?? undefined} data-today={today || undefined} data-selected={selected || undefined}>
      <span className="calendar-day__number">{day}</span>
    </span>
    {workout && <span className="calendar-day__workout" data-status={workout} />}
  </span>;
}

export function CycleSwatch({ mark }: { mark: CycleMark }) {
  return <span aria-hidden="true" className="cycle-swatch" data-mark={mark} />;
}
