// Экран «История»: месячный календарь-навигатор и список тренировок
// по месяцам. В режиме редактирования здесь же создаются новые тренировки.
// Библиотека упражнений живёт на своей вкладке («Библиотека»).

import { useEffect, useMemo } from 'react';
import type { Workout } from '../types';
import { useApp } from '../store';
import { useT } from '../i18n';
import { fmtDate, fmtDateShort, fmtMonthYear, fmtWeekday, monthKey } from '../lib/dates';
import NewWorkoutForm from '../components/edit/NewWorkoutForm';
import MonthCalendar from '../components/history/MonthCalendar';
import { Chip, IconCheck, IconComment, IconX } from '../components/edit/ui';

/* Экран запоминает прокрутку, чтобы стрелка «назад» возвращала туда же */
const paneMemory = { scroll: 0 };

export default function HistoryScreen() {
  const { workouts, editMode } = useApp();
  const { t } = useT();

  // вернулись на экран: восстанавливаем прокрутку (после первого рендера)
  useEffect(() => {
    if (paneMemory.scroll > 0) {
      const y = paneMemory.scroll;
      requestAnimationFrame(() => window.scrollTo({ top: y }));
    }
    return () => {
      paneMemory.scroll = window.scrollY;
    };
  }, []);

  /* Группы по месяцам: самый свежий месяц первым, внутри — свежие даты выше */
  const groups = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (let i = workouts.length - 1; i >= 0; i--) {
      const w = workouts[i];
      const k = monthKey(w.date);
      const arr = map.get(k);
      if (arr) arr.push(w);
      else map.set(k, [w]);
    }
    return [...map.entries()];
  }, [workouts]);

  return (
    <div className="space-y-4">
      <MonthCalendar />

      {editMode && <NewWorkoutForm />}

      {workouts.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted">
          {t.hist.emptyTitle}
          <br />
          {editMode ? t.hist.emptyEdit : t.hist.emptyNoEdit}
        </div>
      )}

      {groups.map(([k, ws]) => (
        <section key={k}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {fmtMonthYear(k)}
          </h2>
          <ul className="space-y-2">
            {ws.map((w) => (
              <WorkoutRow key={w.id} w={w} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function WorkoutRow({ w }: { w: Workout }) {
  const { editMode, navigate, deleteWorkout, itemKind } = useApp();
  const { t } = useT();
  const hasComment = w.items.some((it) => it.myComment && it.myComment.trim() !== '');
  // разминочные позиции не считаем упражнениями
  const exerciseCount = w.items.filter((it) => itemKind(it) !== 'warmup').length;

  return (
    <li className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => navigate('train', w.id)}
        className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 text-left"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-lg font-bold leading-tight">{fmtDateShort(w.date)}</span>
          <span className="text-muted">{fmtWeekday(w.date)}</span>
          {w.status === 'done' && (
            <span className="text-ok" title={t.hist.doneTitle}>
              <IconCheck size={16} />
            </span>
          )}
          {hasComment && (
            <span className="text-muted" title={t.hist.hasComments}>
              <IconComment size={15} />
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {w.type && <Chip>{t.catalog.workoutType(w.type)}</Chip>}
          <Chip muted>{t.counted.exercises(exerciseCount)}</Chip>
          {w.fatigue != null && <Chip muted>{t.fatigueN(w.fatigue)}</Chip>}
        </div>
      </button>
      {editMode && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t.hist.deleteConfirm(fmtDate(w.date)))) deleteWorkout(w.id);
          }}
          aria-label={t.hist.deleteWorkout}
          title={t.hist.deleteWorkout}
          className="flex w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-danger"
        >
          <IconX />
        </button>
      )}
    </li>
  );
}
