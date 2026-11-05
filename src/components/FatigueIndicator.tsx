/** Каждой оценке — свой цвет по палитре: лайм → янтарь → коралл */
export function fatigueColor(level: number): string {
  const hue = Math.round(85 - ((level - 1) / 9) * 85);
  return `hsl(${hue} 78% 44%)`;
}

/** Лицо едет вместе с ползунком: улыбка → гримаса → крестики-глаза */
export function FatigueFace({ level, size = 26 }: { level: number; size?: number }) {
  const dead = level >= 9;
  // кривизна рта: +3.8 (улыбка, y вниз) → −3.8 (грусть)
  const c = 3.8 - ((level - 1) / 9) * 7.6;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      {dead ? (
        <>
          <path d="M7.4 7.9l2.8 2.8M10.2 7.9l-2.8 2.8" />
          <path d="M13.8 7.9l2.8 2.8M16.6 7.9l-2.8 2.8" />
        </>
      ) : (
        <>
          <circle cx="9" cy="9.7" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9.7" r="1.15" fill="currentColor" stroke="none" />
        </>
      )}
      <path d={`M8.3 15.4 Q12 ${(15.4 + c).toFixed(1)} 15.7 15.4`} />
    </svg>
  );
}

