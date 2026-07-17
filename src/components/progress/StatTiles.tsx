// Плитки со сводной статистикой: 2×2, крупные числа со «взлётом» при открытии.

import { useEffect, useState } from 'react';
import { useApp } from '../../store';
import { daysBetween, todayISO } from '../../lib/dates';
import { fmtNum1 } from './chart';

/** Число «взлетает» от нуля к цели при монтировании (уважая reduced-motion) */
function useCountUp(target: number, ms = 650): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Tile({ label, value, fmt }: { label: string; value: number | null; fmt: (v: number) => string }) {
  const v = useCountUp(value ?? 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">
        {value == null ? '—' : fmt(v)}
      </div>
    </div>
  );
}

export default function StatTiles() {
  const { workouts } = useApp();
  const today = todayISO();
  // Вся сводка — по уже прошедшим датам: запланированные на будущее
  // тренировки не должны увеличивать счётчик и среднее.
  const past = workouts.filter((w) => w.date <= today);
  const total = past.length;
  const first = past.length > 0 ? past[0] : null;
  const last = past.length > 0 ? past[past.length - 1] : null;

  const weeks = first ? Math.max(0, Math.round(daysBetween(first.date, today) / 7)) : 0;
  const avg = total / Math.max(1, weeks);

  const round = (v: number) => Math.round(v).toLocaleString('ru-RU');

  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile label="Тренировок" value={total} fmt={round} />
      <Tile label="Недель с начала" value={weeks} fmt={round} />
      <Tile label="В неделю в среднем" value={avg} fmt={fmtNum1} />
      <Tile
        label="Дней с последней"
        value={last ? Math.max(0, daysBetween(last.date, today)) : null}
        fmt={round}
      />
    </div>
  );
}
