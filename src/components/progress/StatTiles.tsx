// Плитки со сводной статистикой: 2×2, крупные числа со «взлётом» при открытии.

import { useEffect, useState } from 'react';
import { useApp } from '../../store';
import { locale, useT } from '../../i18n';
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

/* Плитка в том же языке, что дашборд Главной: капс-подпись + крупное число */
function Tile({ label, value, fmt }: { label: string; value: number | null; fmt: (v: number) => string }) {
  const v = useCountUp(value ?? 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 text-2xl font-extrabold tabular-nums">
        {value == null ? '—' : fmt(v)}
      </div>
    </div>
  );
}

export default function StatTiles() {
  const { workouts } = useApp();
  const { t } = useT();
  const today = todayISO();
  // Вся сводка — по уже прошедшим датам: запланированные на будущее
  // тренировки не должны увеличивать счётчик и среднее.
  const past = workouts.filter((w) => w.date <= today);
  const total = past.length;
  const first = past.length > 0 ? past[0] : null;
  const last = past.length > 0 ? past[past.length - 1] : null;

  const weeks = first ? Math.max(0, Math.round(daysBetween(first.date, today) / 7)) : 0;
  const avg = total / Math.max(1, weeks);

  const round = (v: number) => Math.round(v).toLocaleString(locale());

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Tile label={t.prog.tileWorkouts} value={total} fmt={round} />
      <Tile label={t.prog.tileWeeks} value={weeks} fmt={round} />
      <Tile label={t.prog.tileAvg} value={avg} fmt={fmtNum1} />
      <Tile
        label={t.prog.tileDaysSince}
        value={last ? Math.max(0, daysBetween(last.date, today)) : null}
        fmt={round}
      />
    </div>
  );
}
