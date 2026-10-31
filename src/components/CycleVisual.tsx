import type { CycleMark } from '../lib/cycle';

/** Small symbols for the memo; calendars use soft phase fills behind the date. */
export function CycleSymbol({ mark, className = '' }: { mark: CycleMark; className?: string }) {
  if (mark === 'ovulation') return <svg aria-hidden="true" viewBox="0 0 16 16" className={`cycle-symbol cycle-symbol--ovulation ${className}`}>
    <path d="M8 2v12M2.8 5l10.4 6M2.8 11l10.4-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
  return <svg aria-hidden="true" viewBox="0 0 16 16" className={`cycle-symbol cycle-symbol--period ${className}`}>
    <path d="M8 1.8C6.9 3.9 3.5 7.1 3.5 9.7a4.5 4.5 0 0 0 9 0C12.5 7.1 9.1 3.9 8 1.8Z"
      fill={mark === 'period' ? 'currentColor' : 'var(--card)'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>;
}

/** Position in the usual cycle, not a claim about hormone levels or readiness. */
export function CycleRing({ day, label, length, forecast = false, stale = false }: { day: number | null; label: string; length: number; forecast?: boolean; stale?: boolean }) {
  const progress = day === null || stale ? 0 : Math.min(1, day / length);
  return <span aria-hidden="true" className={`cycle-ring ${stale ? 'cycle-ring--stale' : ''}`}>
    <svg viewBox="0 0 52 52" className="absolute inset-0 h-full w-full -rotate-90">
      {Array.from({ length: 12 }, (_, i) => {
        const start = (i * 30 + 7) * Math.PI / 180;
        const end = (i * 30 + 23) * Math.PI / 180;
        return <path key={i} d={`M${26 + 22 * Math.cos(start)} ${26 + 22 * Math.sin(start)} A22 22 0 0 1 ${26 + 22 * Math.cos(end)} ${26 + 22 * Math.sin(end)}`}
          className={i < Math.ceil(progress * 12) ? 'cycle-ring__elapsed' : 'cycle-ring__remaining'} fill="none" strokeWidth="3.5" strokeLinecap="round" />;
      })}
    </svg>
    <span className="relative flex flex-col items-center">
      <span className={`font-extrabold leading-none tabular-nums ${forecast ? 'text-base' : 'text-xl'}`}>{day === null ? '+' : `${forecast ? '≈' : ''}${day}`}</span>
      {day !== null && <span className="mt-0.5 text-[9px] leading-none text-muted">{label}</span>}
    </span>
  </span>;
}
