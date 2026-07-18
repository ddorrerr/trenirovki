// Работа с датами. Даты храним как ISO-строки "YYYY-MM-DD",
// форматируем всегда в UTC, чтобы день не «уползал» из-за часового пояса.
// Язык подписей берётся из i18n: ru — «13 июня», en — "13 June".

import { locale } from '../i18n/lang';

const UTC = { timeZone: 'UTC' } as const;

function toDate(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}

/** "13 июня 2025" / "13 June 2025" — без хвостового « г.», одинаково на всех экранах */
export function fmtDate(iso: string): string {
  return toDate(iso)
    .toLocaleDateString(locale(), { ...UTC, day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/\s*г\.$/, '');
}

/** "13 июня" / "13 June" */
export function fmtDateShort(iso: string): string {
  return toDate(iso).toLocaleDateString(locale(), { ...UTC, day: 'numeric', month: 'long' });
}

/** "пятница" / "Friday" */
export function fmtWeekday(iso: string): string {
  return toDate(iso).toLocaleDateString(locale(), { ...UTC, weekday: 'long' });
}

/** "2025-06" — ключ для группировки по месяцам */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "Июнь 2025" / "June 2025" (по ключу месяца или полной дате) */
export function fmtMonthYear(isoOrKey: string): string {
  const iso = isoOrKey.length === 7 ? isoOrKey + '-01' : isoOrKey;
  const s = toDate(iso).toLocaleDateString(locale(), { ...UTC, month: 'long', year: 'numeric' });
  const noG = s.replace(/\s*г\.$/, '');
  return noG.charAt(0).toUpperCase() + noG.slice(1);
}

/** Сегодня как "YYYY-MM-DD" (в местном времени пользователя) */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Целое число дней между двумя ISO-датами (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
}
