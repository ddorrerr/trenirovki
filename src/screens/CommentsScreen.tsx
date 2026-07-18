// Экран «Комментарии»: вся лента комментариев Лизы, свежие сверху,
// сгруппированы по тренировкам. Открывается из «Фидбэка» на Главной
// (режим тренера); тап по записи открывает ту тренировку.

import { useMemo } from 'react';
import { useApp } from '../store';
import { fmtDate, fmtWeekday } from '../lib/dates';
import { SkullIcon } from '../components/train/icons';

interface Entry {
  itemId: string;
  name: string;
  pvr: string | null;
  comment: string;
}

export default function CommentsScreen() {
  const { workouts, navigate, exerciseById } = useApp();

  const groups = useMemo(() => {
    const out: { workoutId: string; date: string; entries: Entry[] }[] = [];
    for (let i = workouts.length - 1; i >= 0; i--) {
      const w = workouts[i];
      const entries: Entry[] = [];
      for (const it of w.items) {
        const comment = (it.myComment ?? '').trim();
        if (!comment) continue;
        entries.push({
          itemId: it.id,
          name:
            exerciseById(it.exerciseId)?.name ??
            it.nameRaw.replace(/^\s*\d+(?:\.\d+)*\s*[.)]\s*/, ''),
          pvr: it.pvr,
          comment,
        });
      }
      if (entries.length > 0) out.push({ workoutId: w.id, date: w.date, entries });
    }
    return out;
  }, [workouts, exerciseById]);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted">
        Пока нет ни одного комментария.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.workoutId}>
          <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted">
            {fmtDate(g.date)}, {fmtWeekday(g.date)}
          </h2>
          <button
            type="button"
            onClick={() => navigate('train', g.workoutId)}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left"
          >
            <ul className="space-y-2.5">
              {g.entries.map((e) => (
                <li key={e.itemId} className="text-sm leading-snug">
                  <span className="font-bold">{e.name}</span>
                  {e.pvr && (
                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-lg bg-chip px-1.5 py-0.5 align-middle text-xs font-bold tabular-nums">
                      <span className="text-muted">
                        <SkullIcon size={12} />
                      </span>
                      {e.pvr}
                    </span>
                  )}
                  <span className="block text-muted">«{e.comment}»</span>
                </li>
              ))}
            </ul>
          </button>
        </section>
      ))}
    </div>
  );
}
