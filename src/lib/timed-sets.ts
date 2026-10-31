import type { Workout, WorkoutItem } from '../types';

/** Duration needs explicit units (or m:ss), so ordinary repetitions never become seconds. */
export function parseSetSeconds(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase().replace(/\.$/, '');
  const clock = /^(\d+):([0-5]\d)$/.exec(text);
  let seconds: number;
  if (clock) seconds = Number(clock[1]) * 60 + Number(clock[2]);
  else {
    const match = /^(?:(\d+(?:[.,]\d+)?)\s*(?:мин(?:ут[аы]?)?|min(?:ute)?s?|m)\.?\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:сек(?:унд[аы]?)?|sec(?:ond)?s?|[сs])\.?)?$/.exec(text);
    if (!match || (!match[1] && !match[2])) return null;
    seconds = Math.round(Number((match[1] ?? '0').replace(',', '.')) * 60 + Number((match[2] ?? '0').replace(',', '.')));
  }
  return seconds >= 5 && seconds <= 1200 ? seconds : null;
}

export function timedSetPlan(item: WorkoutItem): number[] | null {
  // Imported plans can append a short note after an explicit duration.
  // Only a words-only suffix is allowed: ranges and extra numeric instructions remain ambiguous.
  const prescribedSeconds = (raw: string | null | undefined): number | null => {
    const exact = parseSetSeconds(raw);
    if (exact != null || !raw) return exact;
    for (const match of raw.matchAll(/\s+/g)) {
      const suffix = raw.slice(match.index! + match[0].length);
      if (!/^[\p{L}\s.,]+$/u.test(suffix)) continue;
      const seconds = parseSetSeconds(raw.slice(0, match.index));
      if (seconds != null) return seconds;
    }
    return null;
  };
  if (item.perSetPlan?.length) {
    const seconds = item.perSetPlan.map(row => prescribedSeconds(row.reps));
    return seconds.every((value): value is number => value != null) ? seconds : null;
  }
  const match = /^\s*(\d+)\s*[xх×]\s*(.+)$/i.exec(item.setsReps?.raw ?? '');
  const seconds = prescribedSeconds(match ? match[2] : item.setsReps?.raw);
  const count = match ? Number(match[1]) : (item.setsReps?.sets ?? 1);
  return seconds != null && count >= 1 && count <= 50 ? Array.from({ length: count }, () => seconds) : null;
}

/** Idempotent confirmation; a stale timer cannot complete a different/edited/finished set. */
export function confirmTimedSet(workout: Workout, itemId: string, setIndex: number, seconds: number): Workout | null {
  if (workout.status !== 'planned' || !workout.startedAt) return null;
  const item = workout.items.find(value => value.id === itemId);
  if (!item || item.done || item.skipped || (item.setsDone ?? 0) !== setIndex) return null;
  const plan = timedSetPlan(item);
  if (!plan || plan[setIndex] !== seconds) return null;
  const setsDone = setIndex + 1;
  return { ...workout, items: workout.items.map(value => value.id === itemId
    ? { ...value, setsDone, done: setsDone >= plan.length, skipped: false } : value) };
}
