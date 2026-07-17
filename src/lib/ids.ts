// Генерация стабильных читаемых id.

/** "w-2026-07-18", при повторе даты — "w-2026-07-18-2", "-3", ... */
export function workoutIdForDate(dateISO: string, existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  const base = `w-${dateISO}`;
  if (!existing.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!existing.has(id)) return id;
  }
}

/** id позиции внутри тренировки: "<workoutId>-i3" */
export function itemId(workoutId: string, n: number): string {
  return `${workoutId}-i${n}`;
}

/** Следующий свободный номер позиции для тренировки */
export function nextItemId(workoutId: string, existingItemIds: Iterable<string>): string {
  const existing = new Set(existingItemIds);
  for (let n = 1; ; n++) {
    const id = itemId(workoutId, n);
    if (!existing.has(id)) return id;
  }
}

/** "ex-<N+1>" по максимальному существующему номеру */
export function nextExerciseId(existingIds: Iterable<string>): string {
  let max = 0;
  for (const id of existingIds) {
    const m = /^ex-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `ex-${max + 1}`;
}
