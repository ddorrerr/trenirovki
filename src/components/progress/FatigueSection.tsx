// «Усталость»: точечный график 1–10 по датам (если отметок ≥ 3),
// иначе — простой список. Берём только тренировки с fatigue != null.

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useApp } from '../../store';
import { fmtDate, fmtDateShort } from '../../lib/dates';
import { clamp, dateTicks, parseTime, type DateTick } from './chart';
import { useMeasuredWidth } from './useMeasuredWidth';

interface FatiguePoint {
  id: string;
  date: string;
  t: number;
  value: number;
}

const H = 170;
const ML = 30;
const MR = 14;
const MT = 14;
const MB = 26;
const INNER_H = H - MT - MB;
const TIP_W = 150;
const HALF_DAY = 43_200_000;

export default function FatigueSection() {
  const { workouts } = useApp();

  const entries = useMemo<FatiguePoint[]>(
    () =>
      workouts.flatMap((w) =>
        w.fatigue == null
          ? []
          : [{ id: w.id, date: w.date, t: parseTime(w.date), value: w.fatigue }],
      ),
    [workouts],
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Усталость</h2>

      {entries.length === 0 ? (
        <p className="py-8 text-center text-muted">Пока нет отметок усталости после тренировок.</p>
      ) : entries.length < 3 ? (
        <ul className="mt-3 space-y-1.5 text-muted">
          {entries.map((e) => (
            <li key={e.id}>
              {fmtDate(e.date)} — {e.value}/10
            </li>
          ))}
        </ul>
      ) : (
        <FatigueChart entries={entries} />
      )}
    </section>
  );
}

function FatigueChart({ entries }: { entries: FatiguePoint[] }) {
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    setActive(null);
  }, [entries]);

  // Тап мимо графика убирает подсказку — как на графике веса
  useEffect(() => {
    if (active == null) return;
    const onDocDown = (e: PointerEvent) => {
      const wrap = wrapRef.current;
      if (wrap && !wrap.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [active, wrapRef]);

  const w = Math.max(width, 220);
  const innerW = w - ML - MR;

  const scale = useMemo(() => {
    const ts = entries.map((e) => e.t);
    let t0 = Math.min(...ts);
    let t1 = Math.max(...ts);
    const pad = Math.max((t1 - t0) * 0.03, HALF_DAY);
    t0 -= pad;
    t1 += pad;
    const n = Math.max(3, Math.min(5, Math.floor(innerW / 85)));
    return { t0, t1, xTicks: dateTicks(t0, t1, n) };
  }, [entries, innerW]);

  const x = (t: number) => ML + ((t - scale.t0) / (scale.t1 - scale.t0)) * innerW;
  const y = (v: number) => MT + (1 - (v - 1) / 9) * INNER_H;

  const pick = (e: ReactPointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * w;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < entries.length; i++) {
      const d = Math.abs(x(entries[i].t) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setActive(best);
  };

  const a = active != null && active < entries.length ? entries[active] : null;
  const ax = a ? x(a.t) : 0;
  const ay = a ? y(a.value) : 0;

  return (
    <div ref={wrapRef} className="relative mt-3">
      {width > 0 && (
        <svg
          viewBox={`0 0 ${w} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          className="block"
          role="img"
          aria-label="Усталость по датам, шкала от 1 до 10"
        >
          {[1, 5, 10].map((v) => (
            <g key={v}>
              <line x1={ML} x2={w - MR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
              <text
                x={ML - 8}
                y={y(v)}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="var(--muted)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {v}
              </text>
            </g>
          ))}

          {scale.xTicks.map((tick, i) => (
            <text
              key={i}
              x={x(tick.t)}
              y={H - 7}
              fontSize={11}
              fill="var(--muted)"
              textAnchor={i === 0 ? 'start' : i === scale.xTicks.length - 1 ? 'end' : 'middle'}
            >
              {tick.label}
            </text>
          ))}

          {a && (
            <line
              x1={ax}
              x2={ax}
              y1={MT}
              y2={H - MB}
              stroke="var(--muted)"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          )}

          {entries.map((e) => (
            <circle
              key={e.id}
              cx={x(e.t)}
              cy={y(e.value)}
              r={4}
              fill="var(--accent)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}

          {a && (
            <circle
              cx={ax}
              cy={ay}
              r={8.5}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.45}
              strokeWidth={2}
            />
          )}

          <rect
            x={0}
            y={0}
            width={w}
            height={H}
            fill="transparent"
            style={{ touchAction: 'pan-y' }}
            onPointerMove={(e) => {
              if (e.pointerType === 'mouse') pick(e);
            }}
            onPointerDown={pick}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setActive(null);
            }}
          />
        </svg>
      )}

      {a && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-border bg-card p-3 shadow-lg"
          style={{
            width: TIP_W,
            left: clamp(ax - TIP_W / 2, 4, Math.max(4, w - TIP_W - 4)),
            ...(ay > H * 0.5 ? { bottom: H - ay + 14 } : { top: ay + 14 }),
          }}
        >
          <div className="text-sm font-semibold">{fmtDateShort(a.date)}</div>
          <div className="mt-0.5 text-base font-semibold">
            {a.value}/10 <span className="font-normal text-muted">усталость</span>
          </div>
        </div>
      )}
    </div>
  );
}
