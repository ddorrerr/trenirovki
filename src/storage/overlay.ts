// Оверлей правок: словари «id -> запись | null», где null = запись удалена.
// Общая механика для локального адаптера (правки поверх seed) и GitHub-адаптера
// (несинхронизированные правки поверх данных из репозитория).

import type { AppData, Exercise, Workout } from '../types';

export interface Overlay {
  workouts: Record<string, Workout | null>;
  exercises: Record<string, Exercise | null>;
}

export function emptyOverlay(): Overlay {
  return { workouts: {}, exercises: {} };
}

export function overlaySize(o: Overlay): number {
  return Object.keys(o.workouts).length + Object.keys(o.exercises).length;
}

export function readOverlay(storageKey: string): Overlay {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as Partial<Overlay>;
    return { workouts: parsed.workouts ?? {}, exercises: parsed.exercises ?? {} };
  } catch {
    return emptyOverlay();
  }
}

export function writeOverlay(storageKey: string, o: Overlay): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(o));
  } catch (e) {
    console.error('Не удалось сохранить изменения в localStorage', e);
  }
}

function mergeCollection<T extends { id: string }>(
  base: T[],
  patch: Record<string, T | null>,
): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(item.id, item);
  for (const [id, value] of Object.entries(patch)) {
    if (value === null) map.delete(id);
    else map.set(id, value);
  }
  return [...map.values()];
}

/**
 * Приводим позиции тренировки к инварианту «порядок в массиве == order == 1..n».
 * В импортированных данных встречаются массивы, не отсортированные по order,
 * и дубли order — из-за этого чтение и редактор показывали разный порядок.
 */
export function normalizeItems(w: Workout): Workout {
  const sorted = [...w.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const ok = sorted.every((it, i) => it === w.items[i] && it.order === i + 1);
  if (ok) return w;
  return { ...w, items: sorted.map((it, i) => (it.order === i + 1 ? it : { ...it, order: i + 1 })) };
}

/** База + оверлей -> итоговые данные (с нормализацией позиций) */
export function applyOverlay(base: AppData, overlay: Overlay): AppData {
  return {
    exercises: mergeCollection(base.exercises, overlay.exercises),
    workouts: mergeCollection(base.workouts, overlay.workouts).map(normalizeItems),
  };
}
