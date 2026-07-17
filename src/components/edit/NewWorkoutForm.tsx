// Форма «Новая тренировка»: пустая или копия существующей.
// Используется в «Истории» и на «Тренировке» в режиме редактирования.

import { useMemo, useState } from 'react';
import type { Workout } from '../../types';
import { useApp } from '../../store';
import { fmtDate, fmtDateShort, fmtWeekday, todayISO } from '../../lib/dates';
import { itemId, workoutIdForDate } from '../../lib/ids';
import { IconPlus, inputCls, plural } from './ui';

type FillMode = 'empty' | 'last' | 'pick';

/**
 * Строки-«просьбы» (начинаются с 📌) относятся к конкретному дню —
 * при копировании тренировки их не переносим.
 */
function stripPinnedLines(note: string | null): string | null {
  if (!note) return null;
  const kept = note.split('\n').filter((l) => !l.trim().startsWith('📌'));
  return kept.join('\n').trim() ? kept.join('\n') : null;
}

/**
 * Тип тренировки по дню недели: среда — «с тренером», вс/пн — «сама»
 * (правило Лизы; остальные дни — без типа, можно выбрать вручную).
 */
function typeForDate(iso: string): string | null {
  const wd = new Date(iso + 'T00:00:00Z').getUTCDay(); // 0 = вс
  if (wd === 3) return 'с тренером';
  if (wd === 0 || wd === 1) return 'сама';
  return null;
}

const FILL_OPTIONS: { id: FillMode; label: string }[] = [
  { id: 'empty', label: 'Пустая' },
  { id: 'last', label: 'Копия последней' },
  { id: 'pick', label: 'Копия выбранной' },
];

export default function NewWorkoutForm() {
  const { workouts, saveWorkout, navigate } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<FillMode>('empty');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const last10 = useMemo(() => workouts.slice(-10).reverse(), [workouts]);
  const lastWorkout = workouts.length ? workouts[workouts.length - 1] : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDate(todayISO());
          setOpen(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg"
      >
        <IconPlus size={16} /> Новая тренировка
      </button>
    );
  }

  const source: Workout | null =
    mode === 'empty'
      ? null
      : mode === 'last'
        ? lastWorkout
        : (last10.find((w) => w.id === pickedId) ?? null);

  const canCreate = date !== '' && (mode === 'empty' || source !== null);

  const create = () => {
    if (!canCreate) return;
    const id = workoutIdForDate(
      date,
      workouts.map((w) => w.id),
    );
    const w: Workout = {
      id,
      date,
      title: source?.title ?? null,
      type: typeForDate(date),
      status: 'planned',
      fatigue: null,
      source: 'app',
      sourceRef: null,
      notes: '',
      warmup: source ? source.warmup.map((x) => ({ ...x })) : [],
      warmupVideoUrl: source?.warmupVideoUrl ?? null,
      items: source
        ? source.items.map((it, i) => ({
            ...it,
            id: itemId(id, i + 1),
            order: i + 1,
            setsReps: it.setsReps ? { ...it.setsReps } : null,
            weight: it.weight ? { ...it.weight } : null,
            subNotes: (it.subNotes ?? []).map((s) => ({ ...s })),
            ptNote: stripPinnedLines(it.ptNote),
            ptRequest: null, // просьба тренера относилась к конкретному дню
            myComment: '',
            actual: null,
            done: false,
          }))
        : [],
    };
    saveWorkout(w);
    setOpen(false);
    setMode('empty');
    setPickedId(null);
    navigate('train', id);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Новая тренировка
      </h2>

      <div className="mt-3">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Дата</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-sm text-muted">Чем наполнить</span>
        <div className="space-y-1.5">
          {FILL_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              className={
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ' +
                (mode === o.id ? 'border-accent bg-accent-soft' : 'border-border bg-bg')
              }
            >
              <span
                className={
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ' +
                  (mode === o.id ? 'border-accent' : 'border-border')
                }
              >
                {mode === o.id && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              <span className="font-medium">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'last' &&
        (lastWorkout ? (
          <p className="mt-2 text-sm text-muted">
            Скопируем тренировку от {fmtDate(lastWorkout.date)} (
            {plural(lastWorkout.items.length, 'упражнение', 'упражнения', 'упражнений')}).
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Копировать пока нечего.</p>
        ))}

      {mode === 'pick' && (
        <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
          {last10.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setPickedId(w.id)}
                className={
                  'w-full rounded-xl border px-3 py-2.5 text-left ' +
                  (pickedId === w.id ? 'border-accent bg-accent-soft' : 'border-border bg-bg')
                }
              >
                <span className="font-medium">{fmtDateShort(w.date)}</span>{' '}
                <span className="text-sm text-muted">
                  {fmtWeekday(w.date)} ·{' '}
                  {plural(w.items.length, 'упражнение', 'упражнения', 'упражнений')}
                  {w.type ? ` · ${w.type}` : ''}
                </span>
              </button>
            </li>
          ))}
          {last10.length === 0 && (
            <li className="px-1 py-2 text-sm text-muted">Копировать пока нечего.</li>
          )}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={create}
          disabled={!canCreate}
          className={
            'flex-1 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg ' +
            (canCreate ? '' : 'opacity-50')
          }
        >
          Создать
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border bg-card px-4 py-2.5"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
