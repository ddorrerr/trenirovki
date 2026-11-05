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

/** A bounded forecast is derived for display only; it never creates period records. */
function cycleWindow(cycle: CycleData | null, date: string, today: string) {
  if (!cycle || !validCycle(cycle) || !validCycleDate(date) || !validCycleDate(today)) return null;
  const periods = sortedPeriods(cycle);
  let index = periods.length - 1;
  while (index >= 0 && periods[index].start > date) index--;
  const period = periods[index];
  if (!period) return null;
  const next = periods[index + 1];
  const firstExpected = next?.start ?? cycleAddDays(period.start, cycle.cycleLength);
  const stale = !next && distance(firstExpected, today) > 7;
  if (!next && date > today && (stale || distance(today, date) > 90)) return null;
  // Only future dates can advance into projected cycles. Today's missed start
  // stays visible as a request to update, instead of silently resetting day one.
  const cyclesAhead = !next && date > today ? Math.floor(distance(period.start, date) / cycle.cycleLength) : 0;
  const start = cyclesAhead > 0 ? cycleAddDays(period.start, cyclesAhead * cycle.cycleLength) : period.start;
  const expected = cyclesAhead > 0 ? cycleAddDays(start, cycle.cycleLength) : firstExpected;
  return { period, start, expected, forecast: cyclesAhead > 0, stale,
    overdue: !next && date <= today && date > firstExpected,
    ovulationDate: cycleAddDays(expected, -14),
    ovulationStart: cycleAddDays(expected, -16), ovulationEnd: cycleAddDays(expected, -12) };
}

function windowMarker(cycle: CycleData, date: string, window: NonNullable<ReturnType<typeof cycleWindow>>, today: string): CycleMark | null {
  if (date >= window.period.start && date <= (window.period.end ?? window.period.start)) return date > today ? 'periodEstimate' : 'period';
  if (window.stale) return null;
  if (window.forecast && date <= cycleAddDays(window.start, cycle.periodLength - 1)) return 'periodEstimate';
  if (!window.period.end && date < window.expected && date <= cycleAddDays(window.period.start, cycle.periodLength - 1)) return 'periodEstimate';
  if (date >= window.expected && date <= cycleAddDays(window.expected, cycle.periodLength - 1)) return 'periodEstimate';
  if (cycle.showOvulation && date >= window.ovulationStart && date <= window.ovulationEnd) return 'ovulation';
  return null;
}
export function cycleMarker(cycle: CycleData | null, date: string, today: string): CycleMark | null {
  const window = cycleWindow(cycle, date, today);
  return cycle && window ? windowMarker(cycle, date, window, today) : null;
}
export function cycleSummary(cycle: CycleData | null, date: string, today: string) {
  const window = cycleWindow(cycle, date, today);
  if (!cycle || !window) return null;
  return { ...window, day: distance(window.start, date) + 1,
    daysToPeriod: distance(date, window.expected), daysToOvulation: distance(date, window.ovulationDate),
    mark: windowMarker(cycle, date, window, today) };
}

/** Inclusive end: a five-day period starting on the 4th ends on the 8th. */
export function usualPeriodEnd(start: string, length: number): string {
  return validCycleDate(start) && Number.isInteger(length) && length >= 1 && length <= 14
    ? cycleAddDays(start, length - 1) : '';
}

/** Select one useful message; estimates never imply measured ovulation or energy. */
export function cycleMemo(cycle: CycleData | null, date: string, today: string) {
  const summary = cycleSummary(cycle, date, today);
  if (!summary) return null;
  const mode = summary.overdue || summary.stale ? 'update'
    : summary.mark === 'period' || summary.mark === 'periodEstimate' ? 'period'
    : summary.mark === 'ovulation' ? 'ovulation'
    : cycle?.showOvulation && summary.daysToOvulation > 0 && summary.daysToOvulation <= 7 ? 'ovulationSoon'
    : summary.daysToPeriod <= 10 || (cycle?.showOvulation && date > summary.ovulationEnd) ? 'periodSoon' : 'day';
  const value = mode === 'ovulationSoon' ? summary.daysToOvulation
    : mode === 'periodSoon' ? summary.daysToPeriod
    : mode === 'period' && date >= summary.expected ? distance(summary.expected, date) + 1 : summary.day;
  const tone = mode === 'ovulation' || mode === 'ovulationSoon' ? 'lavender' : mode === 'update' ? 'neutral' : 'rose';
  return { ...summary, mode, value, tone } as const;
}

/** Edits preserve all other historical records; ranges must not overlap. */
export function updatePeriod(cycle: CycleData, period: PeriodRecord, previousStart: string | null): CycleData | null {
  if (!validCycleDate(period.start) || (period.end && (!validCycleDate(period.end) || period.end < period.start))) return null;
  const others = cycle.periods.filter(p => p.start !== previousStart);
  if (others.some(p => period.start <= (p.end ?? p.start) && (period.end ?? period.start) >= p.start)) return null;
  return { ...cycle, periods: [...others, period].sort((a, b) => a.start.localeCompare(b.start)) };
}
