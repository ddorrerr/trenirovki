// «Календарь»: теплокарта последних 12 месяцев. Колонка = неделя (Пн сверху),
// закрашенная клетка = день с тренировкой; тап открывает эту тренировку.

import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../store';
import { fmtDate, monthKey, todayISO } from '../../lib/dates';

const CELL = 13;
const GAP = 3;
const PITCH = CELL + GAP;

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = понедельник … 6 = воскресенье */
function mondayIndex(iso: string): number {
  return (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

/** "июн" — короткое имя месяца без точки */
function monthShortRU(iso: string): string {
  return new Date(iso + 'T00:00:00Z')
    .toLocaleDateString('ru-RU', { timeZone: 'UTC', month: 'short' })
    .replace(/\./g, '');
}

export default function CalendarHeatmap() {
  const { workouts, navigate } = useApp();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { days, weekCount, labels, byDate } = useMemo(() => {
    const today = todayISO();
    const start = addDaysISO(today, -364);
    const startMonday = addDaysISO(start, -mondayIndex(start));

    const byDate = new Map<string, string>();
    for (const w of workouts) {
      if (!byDate.has(w.date)) byDate.set(w.date, w.id);
    }

    const days: string[] = [];
    for (let d = startMonday; d <= today; d = addDaysISO(d, 1)) days.push(d);
    const weekCount = Math.ceil(days.length / 7);

    // подпись месяца над колонкой, где месяц понедельника сменился
    const labels: { x: number; text: string }[] = [];
    for (let i = 1; i < weekCount; i++) {
      const cur = days[i * 7];
      const prev = days[(i - 1) * 7];
      if (cur && prev && monthKey(cur) !== monthKey(prev)) {
        labels.push({ x: i * PITCH, text: monthShortRU(cur) });
      }
    }

    return { days, weekCount, labels, byDate };
  }, [workouts]);

  // по умолчанию прокручиваем к самым свежим неделям (справа)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weekCount]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Календарь</h2>

      <div ref={scrollRef} className="mt-3 overflow-x-auto pb-1">
        <div style={{ width: weekCount * PITCH - GAP }}>
          <div className="relative h-4">
            {labels.map((l) => (
              <span
                key={l.x}
                className="absolute top-0 text-[10px] leading-4 text-muted"
                style={{ left: l.x }}
              >
                {l.text}
              </span>
            ))}
          </div>
          <div
            className="mt-0.5 grid"
            style={{
              gridAutoFlow: 'column',
              gridTemplateRows: `repeat(7, ${CELL}px)`,
              gridAutoColumns: `${CELL}px`,
              gap: GAP,
            }}
          >
            {days.map((d) => {
              const workoutId = byDate.get(d);
              return workoutId ? (
                <button
                  key={d}
                  type="button"
                  onClick={() => navigate('train', workoutId)}
                  aria-label={'Тренировка ' + fmtDate(d)}
                  title={fmtDate(d)}
                  className="relative rounded-[3px] bg-accent after:absolute after:-inset-0.5 after:content-['']"
                />
              ) : (
                <div key={d} className="rounded-[3px] bg-border/40" />
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent" aria-hidden="true" />
        дни с тренировками
      </p>
    </section>
  );
}
