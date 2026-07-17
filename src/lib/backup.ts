// Резервная копия: выгрузка всех данных одним JSON-файлом.

import type { AppData } from '../types';
import { todayISO } from './dates';

/** Скачивает файл trenirovki-backup-YYYY-MM-DD.json со всеми данными. */
export function downloadBackup(data: AppData): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    exercises: data.exercises,
    workouts: data.workouts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 1)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trenirovki-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Отзываем URL после того, как загрузка успела стартовать.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
