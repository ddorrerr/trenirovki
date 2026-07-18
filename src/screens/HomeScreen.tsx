// Экран «Главная»: сводка одним взглядом — сколько дней с последней
// тренировки, серия недель, следующая и прошлая тренировки, свежий рекорд.
// Всё считается из реальных данных; блоки без данных не показываются.

import { useMemo } from 'react';
import { useApp } from '../store';
import { daysBetween, fmtDate, fmtWeekday, todayISO } from '../lib/dates';
import { plural } from '../components/edit/ui';
import { BarbellIcon, CommentIcon, FlameIcon } from '../components/train/icons';

/** Понедельник недели данной даты (UTC), ISO-строкой */
function mondayISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11
    ? 'день'
    : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)
      ? 'дня'
      : 'дней';
}

/** «Суббота, 19 июля» — день недели с большой буквы, без года */
function fmtDayTitle(iso: string): string {
  const wd = fmtWeekday(iso);
  const date = new Date(iso + 'T00:00:00Z').toLocaleDateString('ru-RU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${date}`;
}

export default function HomeScreen() {
  const { workouts, navigate, exerciseById, showExerciseProgress } = useApp();
  const today = todayISO();

  const past = useMemo(() => workouts.filter((w) => w.date <= today), [workouts, today]);
  const last = past.length ? past[past.length - 1] : null;
  const next = useMemo(
    () => workouts.find((w) => w.date >= today && w.status === 'planned') ?? null,
    [workouts, today],
  );
  const daysSince = last ? Math.max(0, daysBetween(last.date, today)) : null;

  /* Серия: сколько недель подряд была хотя бы одна тренировка.
     Текущая неделя без тренировки серию не рвёт — она ещё идёт. */
  const streak = useMemo(() => {
    const weeks = new Set(past.map((w) => mondayISO(w.date)));
    let cur = mondayISO(today);
    if (!weeks.has(cur)) cur = addDaysISO(cur, -7);
    let n = 0;
    while (weeks.has(cur)) {
      n++;
      cur = addDaysISO(cur, -7);
    }
    return n;
  }, [past, today]);

  /* Свежий рекорд: последний раз, когда вес упражнения стал выше всех
     прошлых (не первые пробы — до того минимум два раза), за 30 дней */
  const record = useMemo(() => {
    const best = new Map<string, number>();
    const seen = new Map<string, number>();
    let latest: { exerciseId: string; weight: number; date: string } | null = null;
    for (const w of past) {
      for (const it of w.items) {
        const kg = it.actual?.weight ?? it.weight?.value;
        if (kg == null || !it.exerciseId) continue;
        const was = best.get(it.exerciseId);
        const n = seen.get(it.exerciseId) ?? 0;
        if (was == null || kg > was) {
          best.set(it.exerciseId, kg);
          if (n >= 2 && daysBetween(w.date, today) <= 30) {
            latest = { exerciseId: it.exerciseId, weight: kg, date: w.date };
          }
        }
        seen.set(it.exerciseId, n + 1);
      }
    }
    return latest;
  }, [past, today]);
  const recordName = record ? (exerciseById(record.exerciseId)?.name ?? null) : null;

  const lastComments = last
    ? last.items.filter((i) => i.myComment && i.myComment.trim() !== '').length
    : 0;

  if (workouts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted">
        Пока нет ни одной тренировки — включи режим редактирования (карандаш сверху)
        и добавь первую.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Герой: дни с последней тренировки + серия и счётчик */}
      <div className="px-1 pt-1">
        <p className="text-[32px] font-extrabold leading-tight tracking-tight">
          {daysSince == null ? (
            'Начнём?'
          ) : daysSince === 0 ? (
            <>
              Сегодня{' '}
              <span className="text-[15px] font-semibold text-muted">была тренировка</span>
            </>
          ) : (
            <>
              {daysSince} {dayWord(daysSince)}{' '}
              <span className="text-[15px] font-semibold text-muted">
                с последней тренировки
              </span>
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-chip px-2.5 py-1 text-xs font-semibold">
              <span className="text-muted">
                <FlameIcon size={14} />
              </span>
              {plural(streak, 'неделя', 'недели', 'недель')} подряд
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-chip px-2.5 py-1 text-xs font-semibold tabular-nums">
            <span className="text-muted">
              <BarbellIcon size={14} />
            </span>
            {past.length} всего
          </span>
        </div>
      </div>

      {/* Следующая запланированная */}
      {next && (
        <button
          type="button"
          onClick={() => navigate('train', next.id)}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left"
        >
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted">
            {next.date === today ? 'Сегодня' : 'Следующая'}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 text-base font-bold">
              {fmtDayTitle(next.date)}
              {next.title ? ` · ${next.title}` : next.type ? ` · ${next.type}` : ''}
            </span>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-accent"
              aria-hidden="true"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
        </button>
      )}

      {/* Прошлая тренировка */}
      {last && (
        <button
          type="button"
          onClick={() => navigate('train', last.id)}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left"
        >
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted">Прошлая</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-bold">{fmtDayTitle(last.date)}</span>
            {last.status === 'done' && (
              <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok-text">
                выполнена
              </span>
            )}
          </div>
          {(last.fatigue != null || lastComments > 0) && (
            <p className="mt-1.5 flex items-center gap-2.5 text-xs text-muted">
              {last.fatigue != null && <span>усталость {last.fatigue}/10</span>}
              {lastComments > 0 && (
                <span className="inline-flex items-center gap-1">
                  <CommentIcon size={13} /> {lastComments}
                </span>
              )}
            </p>
          )}
        </button>
      )}

      {/* Свежий рекорд — тап открывает график этого упражнения */}
      {record && recordName && (
        <button
          type="button"
          onClick={() => showExerciseProgress(record.exerciseId)}
          className="w-full rounded-2xl bg-ok-soft p-4 text-left"
        >
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-ok-text">
            <TrophyIcon /> Новый максимум
          </p>
          <p className="mt-1 text-base font-bold text-ok-text">
            {recordName} — {record.weight} кг{' '}
            <span className="text-xs font-semibold opacity-80">{fmtDate(record.date)}</span>
          </p>
        </button>
      )}
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 4h8v4.5a4 4 0 0 1-8 0z" />
      <path d="M8 5.5H5.5V7a2.5 2.5 0 0 0 2.5 2.5" />
      <path d="M16 5.5h2.5V7a2.5 2.5 0 0 1-2.5 2.5" />
      <path d="M12 12.5V16" />
      <path d="M8.5 20h7l-1-4h-5z" />
    </svg>
  );
}
