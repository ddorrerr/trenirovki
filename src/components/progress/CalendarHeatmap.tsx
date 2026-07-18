// «Календарь»: теплокарта последних 12 месяцев. Колонка = неделя (Пн сверху),
// закрашенная клетка = день с тренировкой. Клетки мелкие, поэтому тап (а на
// мыши — наведение) сначала показывает карточку-превью, из неё — переход.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../store';
import type { Workout } from '../../types';
import { locale, useT } from '../../i18n';
import { fmtDate, fmtWeekday, monthKey, todayISO } from '../../lib/dates';

const CELL = 13;
const GAP = 3;
const PITCH = CELL + GAP;
const TIP_W = 200;

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = понедельник … 6 = воскресенье */
function mondayIndex(iso: string): number {
  return (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

/** "июн" / "Jun" — короткое имя месяца без точки */
function monthShort(iso: string): string {
  return new Date(iso + 'T00:00:00Z')
    .toLocaleDateString(locale(), { timeZone: 'UTC', month: 'short' })
    .replace(/\./g, '');
}

interface Preview {
  w: Workout;
  /** координаты центра клетки относительно секции */
  x: number;
  y: number;
  above: boolean;
}

export default function CalendarHeatmap() {
  const { workouts, navigate } = useApp();
  const { t, lang } = useT();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const { days, weekCount, labels, byDate } = useMemo(() => {
    const today = todayISO();
    // лента покрывает всю историю (но минимум год), прокручивается по неделям
    const yearAgo = addDaysISO(today, -364);
    const firstWorkout = workouts.length > 0 ? workouts[0].date : today;
    const start = firstWorkout < yearAgo ? firstWorkout : yearAgo;
    const startMonday = addDaysISO(start, -mondayIndex(start));

    const byDate = new Map<string, Workout>();
    for (const w of workouts) {
      if (!byDate.has(w.date)) byDate.set(w.date, w);
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
        labels.push({ x: i * PITCH, text: monthShort(cur) });
      }
    }

    return { days, weekCount, labels, byDate };
    // lang в зависимостях: подписи месяцев должны пересобраться при смене языка
  }, [workouts, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // по умолчанию прокручиваем к самым свежим неделям (справа)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weekCount]);

  // тап мимо календаря закрывает превью; прокрутка ленты — тоже
  useEffect(() => {
    if (!preview) return;
    const onDocDown = (e: PointerEvent) => {
      const sec = sectionRef.current;
      if (sec && !sec.contains(e.target as Node)) setPreview(null);
    };
    document.addEventListener('pointerdown', onDocDown);
    const scroller = scrollRef.current;
    const onScroll = () => setPreview(null);
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDocDown);
      scroller?.removeEventListener('scroll', onScroll);
    };
  }, [preview]);

  const showPreview = (w: Workout, cell: HTMLElement) => {
    const sec = sectionRef.current;
    if (!sec) return;
    const cellR = cell.getBoundingClientRect();
    const secR = sec.getBoundingClientRect();
    const x = cellR.left - secR.left + cellR.width / 2;
    const y = cellR.top - secR.top;
    setPreview({ w, x, y, above: false });
  };

  const open = (id: string) => {
    setPreview(null);
    navigate('train', id);
  };

  const scrollByWeeks = (weeks: number) => {
    scrollRef.current?.scrollBy({ left: weeks * PITCH, behavior: 'smooth' });
  };

  return (
    <section ref={sectionRef} className="relative rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {t.cal.heatTitle}
        </h2>
        {/* листание ленты: вся история, минимум год */}
        <div className="-my-1 flex gap-1">
          <button
            type="button"
            onClick={() => scrollByWeeks(-8)}
            aria-label={t.cal.earlier}
            title={t.cal.earlier}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg text-muted"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.5 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollByWeeks(8)}
            aria-label={t.cal.later}
            title={t.cal.later}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg text-muted"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.5 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

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
              const workout = byDate.get(d);
              return workout ? (
                <button
                  key={d}
                  type="button"
                  onPointerEnter={(e) => {
                    // наведение мыши — превью сразу (на телефоне не срабатывает)
                    if (e.pointerType === 'mouse') showPreview(workout, e.currentTarget);
                  }}
                  onClick={(e) => {
                    // клетка мелкая: по ней — только превью,
                    // переход — исключительно кнопкой «Открыть» в карточке
                    showPreview(workout, e.currentTarget);
                  }}
                  aria-label={t.cal.workoutAria(fmtDate(d))}
                  aria-expanded={preview?.w.id === workout.id}
                  className={
                    'relative rounded-[3px] after:absolute after:-inset-0.5 after:content-[""] ' +
                    (preview?.w.id === workout.id
                      ? 'bg-ok ring-2 ring-ok ring-offset-1 ring-offset-card'
                      : 'bg-ok')
                  }
                />
              ) : (
                <div key={d} className="rounded-[3px] bg-border/40" />
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-ok" aria-hidden="true" />
        {t.cal.legend}
      </p>

      {/* Карточка-превью тренировки */}
      {preview && (
        <div
          key={preview.w.id}
          className="anim-pop absolute z-10 rounded-xl border border-border bg-card p-3 shadow-lg"
          style={{
            width: TIP_W,
            left: Math.min(
              Math.max(preview.x - TIP_W / 2, 8),
              Math.max(8, (sectionRef.current?.clientWidth ?? 320) - TIP_W - 8),
            ),
            top: preview.y + CELL + 8,
          }}
        >
          <div className="text-sm font-semibold">
            {fmtDate(preview.w.date)}, {fmtWeekday(preview.w.date)}
          </div>
          <div className="mt-0.5 text-sm text-muted">
            {preview.w.status === 'done' ? t.status.done : t.status.planned}
            {preview.w.type ? ` · ${t.catalog.workoutType(preview.w.type)}` : ''}
            {' · '}
            {t.counted.exercises(preview.w.items.length)}
            {preview.w.fatigue != null ? ` · ${t.fatigueN10(preview.w.fatigue)}` : ''}
          </div>
          <button
            type="button"
            onClick={() => open(preview.w.id)}
            className="mt-2.5 w-full rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg"
          >
            {t.open}
          </button>
        </div>
      )}
    </section>
  );
}
