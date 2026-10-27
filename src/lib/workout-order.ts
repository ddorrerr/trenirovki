import type { WorkoutItem } from '../types';

/** Reorder identities only: results, completion and comments stay on their item. */
export function applyWorkoutOrder(items: WorkoutItem[], ids: string[]): WorkoutItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const ordered: WorkoutItem[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item && !seen.has(id)) { ordered.push(item); seen.add(id); }
  }
  ordered.push(...items.filter((item) => !seen.has(item.id)));
  return ordered.map((item, index) => ({ ...item, order: index + 1 }));
}

export function moveOrderItem(ids: string[], from: string, to: string): string[] {
  const start = ids.indexOf(from), end = ids.indexOf(to);
  if (start < 0 || end < 0 || start === end) return ids;
  const next = [...ids];
  next.splice(start, 1);
  next.splice(end, 0, from);
  return next;
}
