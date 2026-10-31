import type { CycleData, PeriodRecord } from '../types';

const DAY = 86_400_000;
export const defaultCycle = (): CycleData => ({ periods: [], cycleLength: 28, periodLength: 5, showOvulation: true });

export function validCycleDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function cycleAddDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
function distance(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}
export function sortedPeriods(cycle: CycleData): PeriodRecord[] {
  return cycle.periods.filter(p => validCycleDate(p.start) && (!p.end || (validCycleDate(p.end) && p.end >= p.start)))
    .sort((a, b) => a.start.localeCompare(b.start));
}
export function validCycle(cycle: CycleData): boolean {
  return Number.isInteger(cycle.cycleLength) && cycle.cycleLength >= 15 && cycle.cycleLength <= 90
    && Number.isInteger(cycle.periodLength) && cycle.periodLength >= 1 && cycle.periodLength <= 14;
}
export type CycleMark = 'period' | 'periodEstimate' | 'ovulation';
export function cycleMarker(cycle: CycleData | null, date: string, today: string): CycleMark | null {
  if (!cycle || !validCycle(cycle) || !validCycleDate(date)) return null;
  const periods = sortedPeriods(cycle);
  if (periods.some(p => date >= p.start && date <= (p.end ?? p.start))) return 'period';
  let index = periods.length - 1;
  while (index >= 0 && periods[index].start > date) index--;
  if (index < 0) return null;
  const p = periods[index];
  const next = periods[index + 1];
  const expected = next?.start ?? cycleAddDays(p.start, cycle.cycleLength);
  // Once a forecast is stale, ask for a new record rather than roll it into fictitious cycles.
  if (!next && distance(expected, today) > 7) return null;
  if (!p.end && date > p.start && date < expected && date <= cycleAddDays(p.start, cycle.periodLength - 1)) return 'periodEstimate';
  if (!next && date >= expected && date <= cycleAddDays(expected, cycle.periodLength - 1)) return 'periodEstimate';
  if (cycle.showOvulation && date >= cycleAddDays(expected, -16) && date <= cycleAddDays(expected, -12)) return 'ovulation';
  return null;
}
export function cycleSummary(cycle: CycleData | null, date: string, today: string) {
  if (!cycle || !validCycle(cycle) || !validCycleDate(date)) return null;
  const periods = sortedPeriods(cycle);
  let index = periods.length - 1;
  while (index >= 0 && periods[index].start > date) index--;
  const period = periods[index];
  if (!period) return null;
  const next = periods[index + 1];
  const expected = next?.start ?? cycleAddDays(period.start, cycle.cycleLength);
  // A future workout may fall in the predicted next period, but not an invented later cycle.
  if (!next && date > today && date > cycleAddDays(expected, cycle.periodLength - 1)) return null;
  const forecast = !next && date > today && date >= expected;
  return { day: distance(forecast ? expected : period.start, date) + 1, expected, forecast,
    overdue: !next && date <= today && date > expected,
    stale: !next && distance(expected, today) > 7,
    mark: cycleMarker(cycle, date, today) };
}

/** Edits preserve all other historical records; ranges must not overlap. */
export function updatePeriod(cycle: CycleData, period: PeriodRecord, previousStart: string | null): CycleData | null {
  if (!validCycleDate(period.start) || (period.end && (!validCycleDate(period.end) || period.end < period.start))) return null;
  const others = cycle.periods.filter(p => p.start !== previousStart);
  if (others.some(p => period.start <= (p.end ?? p.start) && (period.end ?? period.start) >= p.start)) return null;
  return { ...cycle, periods: [...others, period].sort((a, b) => a.start.localeCompare(b.start)) };
}
