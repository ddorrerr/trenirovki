// Месячный календарь-навигатор «Истории»: точка = тренировка в этот день
// (вольт — выполнена, петроль — запланирована), тап по дню открывает её.
// Листается стрелками по месяцам; сегодняшний день обведён.

import { useMemo } from 'react';
import { useApp } from '../../store';
import type { Workout } from '../../types';
import { locale, useT } from '../../i18n';
import { todayISO, fmtDateShort } from '../../lib/dates';
import { cycleMarker } from '../../lib/cycle';
import CalendarDate, { CycleSwatch } from '../CalendarDate';

/** «2026-07» текущего дня */
function ymOf(iso: string): string {
  return iso.slice(0, 7);
}

function ymAdd(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function ymLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale(), {
    timeZone: 'UTC',
    month: 'long',
  });
  return `${name} ${y}`;
}

/** 0 = понедельник … 6 = воскресенье */
function mondayIndex(iso: string): number {
  return (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export default function MonthCalendar({ month: ym, onMonthChange, selectedDate, onSelectDate }: {
  month: string;
  onMonthChange: (month: string) => void;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const { workouts, cycle } = useApp();
  const { t } = useT();
  const today = todayISO();

  const byDate = useMemo(() => {
    const map = new Map<string, Workout>();
    for (const w of workouts) {
      if (!map.has(w.date)) map.set(w.date, w);
    }
    return map;
  }, [workouts]);

  const cells = useMemo(() => {
    const first = `${ym}-01`;
    const lead = mondayIndex(first);
    const total = daysInMonth(ym);
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d++) out.push(`${ym}-${String(d).padStart(2, '0')}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [ym]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {ymLabel(ym)}
        </h2>
        <div className="-my-1 flex gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(ymAdd(ym, -1))}
            aria-label={t.cal.prevMonth}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-chip focus-visible:outline-2 focus-visible:outline-accent"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.5 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(ymAdd(ym, 1))}
            aria-label={t.cal.nextMonth}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-chip focus-visible:outline-2 focus-visible:outline-accent"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.5 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
        {t.weekdaysShort.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          if (!iso) return <span key={i} className="h-11" />;
          const w = byDate.get(iso);
          const mark = cycleMarker(cycle, iso, today);
          const label = [fmtDateShort(iso), w ? `${t.cycle.workout}: ${t.status[w.status]}` : '', mark ? t.cycle[mark] : ''].filter(Boolean).join(', ');
          return <button key={iso} type="button" onClick={() => onSelectDate(iso)} aria-label={label}
            aria-pressed={selectedDate === iso} aria-current={iso === today ? 'date' : undefined}
            className="calendar-date-button flex h-11 items-start justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
            <CalendarDate day={Number(iso.slice(8))} mark={mark} today={iso === today} selected={selectedDate === iso} workout={w?.status} />
          </button>;
        })}
      </div>
      {cycle?.periods.length ? <div className="mt-2 border-t border-border pt-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><CycleSwatch mark="period" />{t.cycle.periodShort}</span>
          <span className="inline-flex items-center gap-1"><CycleSwatch mark="periodEstimate" />{t.cycle.forecastShort}</span>
          {cycle.showOvulation && <span className="inline-flex items-center gap-1"><CycleSwatch mark="ovulation" />{t.cycle.ovulationShort}</span>}
        </div>
      </div> : null}
    </section>
  );
}
