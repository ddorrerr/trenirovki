// Секция «Вес по упражнению»: выбор упражнения, график, максимум и последний раз.

import { useEffect, useMemo, useState } from 'react';
import { useApp, type Occurrence } from '../../store';
import type { WorkoutItem } from '../../types';
import { fmtDateShort, todayISO } from '../../lib/dates';
import { fmtNum, parseTime } from './chart';
import ExercisePicker, { type ExerciseOption } from './ExercisePicker';
import WeightChart, { type WeightPoint } from './WeightChart';

function repsLabel(item: WorkoutItem): string | null {
  const a = item.actual;
  if (a && a.reps != null) return a.sets != null ? `${a.sets}×${a.reps}` : String(a.reps);
  const sr = item.setsReps;
  if (sr && sr.sets != null && sr.reps != null) return `${sr.sets}×${sr.reps}`;
  if (sr && sr.reps != null) return String(sr.reps);
  return null;
}

/* Одно число на точку: записанный факт вытесняет план — как в карточках */
function buildPoints(history: Occurrence[]): WeightPoint[] {
  const out: WeightPoint[] = [];
  for (const { workout, item } of history) {
    const y = item.actual?.weight ?? item.weight?.value ?? null;
    if (y == null) continue;
    const firstLine = item.myComment ? item.myComment.split('\n')[0].trim() : '';
    out.push({
      date: workout.date,
      t: parseTime(workout.date),
      y,
      reps: repsLabel(item),
      comment: firstLine !== '' ? firstLine : null,
    });
  }
  return out;
}

export default function WeightSection() {
  const { exercises, workouts, exerciseHistory } = useApp();

  // сколько раз каждое упражнение встречается и сколько из них с весом
  const counts = useMemo(() => {
    const m = new Map<string, { occ: number; withWeight: number }>();
    for (const w of workouts) {
      for (const it of w.items) {
        let c = m.get(it.exerciseId);
        if (!c) {
          c = { occ: 0, withWeight: 0 };
          m.set(it.exerciseId, c);
        }
        c.occ += 1;
        if ((it.actual?.weight ?? it.weight?.value) != null) c.withWeight += 1;
      }
    }
    return m;
  }, [workouts]);

  const options = useMemo<ExerciseOption[]>(() => {
    return exercises
      .map((e) => ({
        id: e.id,
        name: e.name,
        count: counts.get(e.id)?.occ ?? 0,
        search: (e.name + ' ' + e.aliases.join(' ')).toLowerCase(),
      }))
      .filter((o) => o.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
  }, [exercises, counts]);

  // по умолчанию — упражнение с наибольшим числом появлений с данными о весе
  const defaultId = useMemo(() => {
    let best: string | null = null;
    let bestW = 0;
    for (const o of options) {
      const withW = counts.get(o.id)?.withWeight ?? 0;
      if (withW > bestW) {
        best = o.id;
        bestW = withW;
      }
    }
    return best ?? options[0]?.id ?? null;
  }, [options, counts]);

  const [pickedId, setPickedId] = useState<string | null>(null);
  // переход «График веса» из библиотеки упражнений выбирает упражнение здесь
  const { openExerciseId } = useApp();
  useEffect(() => {
    if (openExerciseId) setPickedId(openExerciseId);
  }, [openExerciseId]);
  const selectedId = pickedId ?? defaultId;

  const points = useMemo(
    () => (selectedId ? buildPoints(exerciseHistory(selectedId)) : []),
    [selectedId, exerciseHistory],
  );

  // «Максимум» и «Последний раз» — только по уже прошедшим датам:
  // запланированная на будущее тренировка не считается сделанным подходом.
  const pastPoints = useMemo(() => {
    const today = todayISO();
    return points.filter((p) => p.date <= today);
  }, [points]);

  const maxPoint = useMemo(() => {
    let m: WeightPoint | null = null;
    for (const p of pastPoints) if (!m || p.y >= m.y) m = p;
    return m;
  }, [pastPoints]);
  const lastPoint = pastPoints.length > 0 ? pastPoints[pastPoints.length - 1] : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Вес по упражнению
      </h2>

      {options.length === 0 ? (
        <p className="py-8 text-center text-muted">
          Пока нет упражнений с историей — всё впереди.
        </p>
      ) : (
        <>
          <div className="mt-3">
            <ExercisePicker options={options} selectedId={selectedId} onSelect={setPickedId} />
          </div>

          {points.length >= 2 ? (
            <>
              <div className="mt-2">
                <WeightChart points={points} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted">
                {maxPoint && (
                  <span>
                    Максимум: {fmtNum(maxPoint.y)} кг · {fmtDateShort(maxPoint.date)}
                  </span>
                )}
                {lastPoint && <span>Последний раз: {fmtDateShort(lastPoint.date)}</span>}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-muted">Пока мало данных по этому упражнению.</p>
          )}
        </>
      )}
    </section>
  );
}
