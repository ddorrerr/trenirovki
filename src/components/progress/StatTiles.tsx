// Плитки со сводной статистикой: 2×2, крупные числа.

import { useApp } from '../../store';
import { daysBetween, todayISO } from '../../lib/dates';
import { fmtNum1 } from './chart';

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

  const tiles: { label: string; value: string }[] = [
    { label: 'Тренировок', value: total.toLocaleString('ru-RU') },
    { label: 'Недель с начала', value: String(weeks) },
    { label: 'В неделю в среднем', value: fmtNum1(avg) },
    {
      label: 'Дней с последней',
      value: last ? String(Math.max(0, daysBetween(last.date, today))) : '—',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm text-muted">{t.label}</div>
          <div className="mt-1 text-3xl font-bold">{t.value}</div>
        </div>
      ))}
    </div>
  );
}
