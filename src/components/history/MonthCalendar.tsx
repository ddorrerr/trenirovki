// Месячный календарь-навигатор «Истории»: точка = тренировка в этот день
// (вольт — выполнена, петроль — запланирована), тап по дню открывает её.
// Листается стрелками по месяцам; сегодняшний день обведён.

import { useMemo, useState } from 'react';
import { useApp } from '../../store';
import type { Workout } from '../../types';
import { todayISO } from '../../lib/dates';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

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
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('ru-RU', {
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

export default function MonthCalendar() {
  const { workouts, navigate } = useApp();
  const today = todayISO();
  const [ym, setYm] = useState(() => ymOf(today));

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
            onClick={() => setYm((v) => ymAdd(v, -1))}
            aria-label="Предыдущий месяц"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg text-muted"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.5 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setYm((v) => ymAdd(v, 1))}
            aria-label="Следующий месяц"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg text-muted"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.5 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          if (!iso) return <span key={i} className="h-10" />;
          const w = byDate.get(iso);
          const isToday = iso === today;
          const day = Number(iso.slice(8));
          if (!w) {
            return (
              <span
                key={i}
                className={
                  'flex h-10 items-center justify-center text-sm tabular-nums ' +
                  (isToday ? 'font-bold' : 'text-muted')
                }
              >
                {day}
              </span>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => navigate('train', w.id)}
              aria-label={`Открыть тренировку ${iso}`}
              className="flex h-10 items-center justify-center"
            >
              <span
                className={
                  'flex h-8 w-8 flex-col items-center justify-center rounded-full text-sm font-bold tabular-nums ' +
                  (w.status === 'done'
                    ? 'bg-ok text-ok-fg'
                    : 'border-2 border-accent text-accent') +
                  (isToday ? ' ring-2 ring-fg/25 ring-offset-1 ring-offset-card' : '')
                }
              >
                {day}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
