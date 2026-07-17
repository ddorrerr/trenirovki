// Локальный адаптер хранилища: неизменяемый seed.json (импорт из таблицы)
// + оверлей правок в localStorage. Используется в разработке и до деплоя;
// в продакшене его место занимает GitHub-адаптер с тем же интерфейсом.

import type { AppData, Exercise, StorageAdapter, Workout } from '../types';
import { applyOverlay, readOverlay, writeOverlay, type Overlay } from './overlay';

const OVERLAY_KEY = 'trenirovki:overlay:v1';

export class LocalAdapter implements StorageAdapter {
  /**
   * Каждая запись перечитывает оверлей из localStorage перед изменением,
   * чтобы два открытых окна/вкладки не затирали правки друг друга.
   */
  private mutate(fn: (o: Overlay) => void): void {
    const o = readOverlay(OVERLAY_KEY);
    fn(o);
    writeOverlay(OVERLAY_KEY, o);
  }

  async load(): Promise<AppData> {
    // Динамический импорт: в GitHub-режиме сборки seed не попадает в основной чанк
    const seedJson = (await import('../data/seed.json')).default;
    const seed = structuredClone(seedJson) as unknown as AppData;
    return applyOverlay(seed, readOverlay(OVERLAY_KEY));
  }

  async saveWorkout(w: Workout): Promise<void> {
    this.mutate((o) => {
      o.workouts[w.id] = w;
    });
  }

  async deleteWorkout(id: string): Promise<void> {
    this.mutate((o) => {
      o.workouts[id] = null;
    });
  }

  async saveExercise(e: Exercise): Promise<void> {
    this.mutate((o) => {
      o.exercises[e.id] = e;
    });
  }

  async deleteExercise(id: string): Promise<void> {
    this.mutate((o) => {
      o.exercises[id] = null;
    });
  }
}
