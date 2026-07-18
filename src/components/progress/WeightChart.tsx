// Линейный график веса по датам (факт вытесняет план ещё при сборке точек).
// Тап/наведение на ближайшую точку показывает карточку-подсказку.

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../../i18n';
import { fmtDate } from '../../lib/dates';
import { clamp, dateTicks, fmtNum, niceScale, type DateTick } from './chart';
import { useMeasuredWidth } from './useMeasuredWidth';

export interface WeightPoint {
  date: string;
  /** метка времени (UTC-полночь даты) */
  t: number;
  /** вес, кг */
  y: number;
  /** подписи для подсказки */
  reps: string | null;
  comment: string | null;
}

const H = 240;
const ML = 48;
const MR = 14;
const MT = 18;
const MB = 26;
const INNER_H = H - MT - MB;
const TIP_W = 184;
const HALF_DAY = 43_200_000;

export default function WeightChart({ points }: { points: WeightPoint[] }) {
  const { t, lang } = useT();
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    setActive(null);
  }, [points]);

  // Тап мимо графика убирает подсказку (на телефоне ей больше некуда деться)
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
    if (points.length === 0) {
      return { t0: 0, t1: 1, lo: 0, hi: 1, yTicks: [] as number[], xTicks: [] as DateTick[] };
    }
    const ts = points.map((p) => p.t);
    const ys = points.map((p) => p.y);
    let t0 = Math.min(...ts);
    let t1 = Math.max(...ts);
    const padX = Math.max((t1 - t0) * 0.02, HALF_DAY);
    t0 -= padX;
    t1 += padX;
    const ny = niceScale(Math.min(...ys), Math.max(...ys));
    const nX = Math.max(3, Math.min(6, Math.floor(innerW / 85)));
    return { t0, t1, lo: ny.lo, hi: ny.hi, yTicks: ny.ticks, xTicks: dateTicks(t0, t1, nX) };
    // lang в зависимостях: подписи дат должны пересобраться при смене языка
  }, [points, innerW, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (points.length < 2) return null;

  const x = (t: number) => ML + ((t - scale.t0) / (scale.t1 - scale.t0)) * innerW;
  const y = (v: number) => MT + (1 - (v - scale.lo) / (scale.hi - scale.lo)) * INNER_H;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`)
    .join(' ');

  const pick = (e: ReactPointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * w;
    const py = ((e.clientY - box.top) / box.height) * H;
    let best = 0;
    let bestKey = Infinity;
    for (let i = 0; i < points.length; i++) {
      // сначала близость по X, при равенстве — по Y (две точки в один день)
      const key = Math.abs(x(points[i].t) - px) * 1000 + Math.abs(y(points[i].y) - py);
      if (key < bestKey) {
        bestKey = key;
        best = i;
      }
    }
    setActive(best);
  };

  const a = active != null && active < points.length ? points[active] : null;
  const ax = a ? x(a.t) : 0;
  const ay = a ? y(a.y) : 0;

  return (
    <div ref={wrapRef} className="relative">
      {width > 0 && (
        <svg
          viewBox={`0 0 ${w} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          className="block"
          role="img"
          aria-label={t.prog.chartAria}
        >
          {/* сетка и подписи оси Y (на верхнем делении — единица «кг») */}
          {scale.yTicks.map((tick, i) => (
            <g key={tick}>
              <line
                x1={ML}
                x2={w - MR}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={ML - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="var(--muted)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {i === scale.yTicks.length - 1 ? `${fmtNum(tick)} ${t.kg}` : fmtNum(tick)}
              </text>
            </g>
          ))}

          {/* подписи оси X */}
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

          {/* перекрестие активной точки */}
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

          {/* линия */}
          <path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* точки */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(p.t)}
              cy={y(p.y)}
              r={4.5}
              fill="var(--accent)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}

          {/* кольцо вокруг активной точки */}
          {a && (
            <circle
              cx={ax}
              cy={ay}
              r={9}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.45}
              strokeWidth={2}
            />
          )}

          {/* слой взаимодействия: мышь — наведение, палец — тап */}
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
          className="anim-pop pointer-events-none absolute z-10 rounded-xl border border-border bg-card p-3 shadow-lg"
          style={{
            width: TIP_W,
            left: clamp(ax - TIP_W / 2, 4, Math.max(4, w - TIP_W - 4)),
            ...(ay > H * 0.52 ? { bottom: H - ay + 14 } : { top: ay + 14 }),
          }}
        >
          <div className="text-sm font-semibold">{fmtDate(a.date)}</div>
          <div className="mt-0.5 text-base font-semibold">
            {fmtNum(a.y)} {t.kg}
          </div>
          {a.reps && <div className="text-sm text-muted">{a.reps}</div>}
          {a.comment && (
            <div className="mt-1 line-clamp-2 break-words text-xs text-muted">{a.comment}</div>
          )}
        </div>
      )}
    </div>
  );
}
