// Утилиты для самодельных SVG-графиков экрана «Прогресс».

import { fmtDateShort } from '../../lib/dates';

/** ISO-дата -> метка времени (UTC-полночь), согласовано с lib/dates */
export function parseTime(iso: string): number {
  return Date.parse(iso + 'T00:00:00Z');
}

/** Метка времени -> ISO-дата (UTC) */
export function isoAtTime(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** "12,5" — число по-русски, без лишних нулей */
export function fmtNum(v: number): string {
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

/** "1,8" — ровно один знак после запятой */
export function fmtNum1(v: number): string {
  return v.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export interface NiceScale {
  ticks: number[];
  lo: number;
  hi: number;
}

/**
 * 3–4 «красивых» деления по оси Y, диапазон с небольшим запасом
 * вокруг данных (не прижат к нулю, но и не уходит в минус).
 */
export function niceScale(minRaw: number, maxRaw: number): NiceScale {
  let min = Math.min(minRaw, maxRaw);
  let max = Math.max(minRaw, maxRaw);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.05;
  min -= pad;
  max += pad;
  if (minRaw >= 0 && min < 0) min = 0;
  const span = max - min;
  const base = Math.pow(10, Math.floor(Math.log10(span / 3)));
  const steps = [base, base * 2, base * 2.5, base * 5, base * 10, base * 20, base * 25, base * 50];
  for (const step of steps) {
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const n = Math.round((hi - lo) / step) + 1;
    if (n <= 4) {
      const ticks: number[] = [];
      for (let i = 0; i < n; i++) ticks.push(round3(lo + step * i));
      return { ticks, lo: round3(lo), hi: round3(hi) };
    }
  }
  return { ticks: [round3(min), round3(max)], lo: round3(min), hi: round3(max) };
}

/** n равномерных отметок времени между t0 и t1 (включительно) */
export function timeTicks(t0: number, t1: number, n: number): number[] {
  if (n < 2) return [t0];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(t0 + ((t1 - t0) * i) / (n - 1));
  return out;
}

export interface DateTick {
  t: number;
  label: string;
}

/** "13 июня" при коротком свежем диапазоне, иначе "13.06.25" */
function tickLabel(iso: string, withYear: boolean): string {
  if (!withYear) return fmtDateShort(iso);
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`;
}

/**
 * Подписи дат по оси X: прижаты к целым дням, без дублей
 * (короткий диапазон давал одинаковые соседние подписи),
 * с годом, если диапазон пересекает границу года или данные не за текущий год.
 */
export function dateTicks(t0: number, t1: number, n: number): DateTick[] {
  const y0 = new Date(t0).getUTCFullYear();
  const y1 = new Date(t1).getUTCFullYear();
  const withYear = y0 !== y1 || y1 !== new Date().getFullYear();
  const out: DateTick[] = [];
  const seen = new Set<string>();
  for (const t of timeTicks(t0, t1, n)) {
    const iso = isoAtTime(t);
    if (seen.has(iso)) continue;
    seen.add(iso);
    out.push({ t, label: tickLabel(iso, withYear) });
  }
  return out;
}
