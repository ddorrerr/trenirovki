// Экран «История»: две вкладки — список тренировок по месяцам
// и библиотека упражнений. В режиме редактирования здесь же создаются
// новые тренировки (пустые или копии) и правится библиотека.

import { useMemo, useState } from 'react';
import type { Exercise, Workout } from '../types';
import { useApp } from '../store';
import {
  fmtDate,
  fmtDateShort,
  fmtMonthYear,
  fmtWeekday,
  monthKey,
  todayISO,
} from '../lib/dates';
import { itemId, nextExerciseId, workoutIdForDate } from '../lib/ids';
import { splitTags } from '../components/edit/parse';
import {
  Chip,
  IconCheck,
  IconComment,
  IconPlay,
  IconPlus,
  IconX,
  TextField,
  inputCls,
  plural,
} from '../components/edit/ui';

type Segment = 'workouts' | 'exercises';

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'workouts', label: 'Тренировки' },
  { id: 'exercises', label: 'Упражнения' },
];

export default function HistoryScreen() {
  const [seg, setSeg] = useState<Segment>('workouts');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeg(s.id)}
            className={
              'rounded-lg px-3 py-2.5 text-sm font-semibold ' +
              (seg === s.id ? 'bg-accent text-accent-fg' : 'text-muted')
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      {seg === 'workouts' ? <WorkoutsPane /> : <ExercisesPane />}
    </div>
  );
}

/* ======================= Вкладка «Тренировки» =========================== */

function WorkoutsPane() {
  const { workouts, editMode } = useApp();

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
    <div className="space-y-5">
      {editMode && <NewWorkoutForm />}

      {workouts.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted">
          Пока нет ни одной тренировки.
          <br />
          {editMode
            ? 'Создай первую кнопкой выше.'
            : 'Включи режим редактирования (карандаш сверху), чтобы добавить первую.'}
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
  const { editMode, navigate, deleteWorkout } = useApp();
  const hasComment = w.items.some((it) => it.myComment && it.myComment.trim() !== '');

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
            <span className="text-ok" title="Выполнена">
              <IconCheck size={16} />
            </span>
          )}
          {hasComment && (
            <span className="text-muted" title="Есть твои комментарии">
              <IconComment size={15} />
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {w.type && <Chip>{w.type}</Chip>}
          <Chip muted>{plural(w.items.length, 'упражнение', 'упражнения', 'упражнений')}</Chip>
          {w.fatigue != null && <Chip muted>усталость {w.fatigue}</Chip>}
        </div>
      </button>
      {editMode && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Удалить тренировку от ${fmtDate(w.date)}? Это действие нельзя отменить.`))
              deleteWorkout(w.id);
          }}
          aria-label="Удалить тренировку"
          title="Удалить тренировку"
          className="flex w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-danger"
        >
          <IconX />
        </button>
      )}
    </li>
  );
}

/* --- Создание новой тренировки ------------------------------------------ */

type FillMode = 'empty' | 'last' | 'pick';

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

function NewWorkoutForm() {
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

/* ======================= Вкладка «Упражнения» =========================== */

function ExercisesPane() {
  const { exercises, exerciseHistory, editMode, saveExercise } = useApp();
  const [query, setQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** только что созданное упражнение держим наверху, пока его не свернули */
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; lastDate: string | null }>();
    for (const e of exercises) {
      const h = exerciseHistory(e.id);
      m.set(e.id, {
        count: h.length,
        lastDate: h.length ? h[h.length - 1].workout.date : null,
      });
    }
    return m;
  }, [exercises, exerciseHistory]);

  const archivedCount = useMemo(() => exercises.filter((e) => e.archived).length, [exercises]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => showArchive || !e.archived)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          (e.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (a.id === pinnedId) return -1;
        if (b.id === pinnedId) return 1;
        const d = (stats.get(b.id)?.count ?? 0) - (stats.get(a.id)?.count ?? 0);
        return d !== 0 ? d : a.name.localeCompare(b.name, 'ru');
      });
  }, [exercises, query, showArchive, stats, pinnedId]);

  const addExercise = () => {
    const ex: Exercise = {
      id: nextExerciseId(exercises.map((e) => e.id)),
      name: 'Новое упражнение',
      aliases: [],
      videoUrl: null,
      tags: [],
      archived: false,
    };
    saveExercise(ex);
    setPinnedId(ex.id);
    setExpandedId(ex.id);
  };

  const toggle = (id: string) => {
    setExpandedId((cur) => {
      const next = cur === id ? null : id;
      if (next !== pinnedId) setPinnedId(null);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {editMode && (
        <button
          type="button"
          onClick={addExercise}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg"
        >
          <IconPlus size={16} /> Новое упражнение
        </button>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск упражнения…"
        aria-label="Поиск упражнения"
        className={inputCls}
      />

      {exercises.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted">
          Библиотека пока пустая.
          {editMode ? ' Добавь первое упражнение кнопкой выше.' : ''}
        </div>
      )}

      <ul className="space-y-2">
        {list.map((e) => {
          const st = stats.get(e.id) ?? { count: 0, lastDate: null };
          return (
            <ExerciseRow
              key={e.id}
              e={e}
              count={st.count}
              lastDate={st.lastDate}
              expanded={expandedId === e.id}
              onToggle={() => toggle(e.id)}
            />
          );
        })}
      </ul>

      {list.length === 0 && exercises.length > 0 && (
        <p className="py-4 text-center text-muted">Ничего не нашлось.</p>
      )}

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchive((v) => !v)}
          className="mx-auto block px-3 py-2 text-sm text-muted underline underline-offset-2"
        >
          {showArchive ? 'скрыть архив' : `показать архив (${archivedCount})`}
        </button>
      )}
    </div>
  );
}

interface ExerciseRowProps {
  e: Exercise;
  count: number;
  lastDate: string | null;
  expanded: boolean;
  onToggle: () => void;
}

function ExerciseRow({ e, count, lastDate, expanded, onToggle }: ExerciseRowProps) {
  const { editMode } = useApp();

  return (
    <li className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words text-lg font-semibold leading-snug">{e.name}</span>
            {e.archived && (
              <span className="rounded-lg border border-border bg-bg px-2 py-0.5 text-xs font-medium text-muted">
                архив
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-muted">
            {count > 0 && lastDate
              ? `${plural(count, 'раз', 'раза', 'раз')} · последний: ${fmtDate(lastDate)}`
              : 'ещё не использовалось'}
          </div>
        </div>
        {e.videoUrl && (
          <span className="shrink-0 text-accent" title="Есть видео">
            <IconPlay />
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border p-4">
          {editMode ? <ExerciseEditPanel e={e} used={count > 0} /> : <ExerciseDetails e={e} />}
        </div>
      )}
    </li>
  );
}

function ExerciseDetails({ e }: { e: Exercise }) {
  const aliases = (e.aliases ?? []).filter((a) => a !== e.name);
  const tags = e.tags ?? [];
  const empty = !e.videoUrl && aliases.length === 0 && tags.length === 0;

  return (
    <div className="space-y-3">
      {e.videoUrl && (
        <a
          href={e.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-medium text-accent"
        >
          <IconPlay size={16} /> Видео техники
        </a>
      )}
      {aliases.length > 0 && (
        <div>
          <div className="mb-1 text-sm text-muted">Также встречается как</div>
          <div className="flex flex-wrap gap-1.5">
            {aliases.map((a) => (
              <Chip key={a} muted>
                {a}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      )}
      {empty && <p className="text-sm text-muted">Дополнительных деталей нет.</p>}
    </div>
  );
}

function ExerciseEditPanel({ e, used }: { e: Exercise; used: boolean }) {
  const { saveExercise, deleteExercise } = useApp();
  const aliases = (e.aliases ?? []).filter((a) => a !== e.name);

  return (
    <div className="space-y-3">
      <TextField
        label="Название"
        value={e.name}
        onCommit={(v) => {
          const name = v.trim();
          if (name) saveExercise({ ...e, name });
        }}
      />
      <TextField
        label="Видео (ссылка)"
        type="url"
        value={e.videoUrl ?? ''}
        placeholder="https://…"
        onCommit={(v) => saveExercise({ ...e, videoUrl: v.trim() || null })}
      />
      <TextField
        label="Метки (через запятую)"
        value={(e.tags ?? []).join(', ')}
        placeholder="напр. спина, тренажёр"
        onCommit={(v) => saveExercise({ ...e, tags: splitTags(v) })}
      />
      {aliases.length > 0 && (
        <div>
          <div className="mb-1 text-sm text-muted">Также встречается как</div>
          <div className="flex flex-wrap gap-1.5">
            {aliases.map((a) => (
              <Chip key={a} muted>
                {a}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => saveExercise({ ...e, archived: !e.archived })}
          className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 font-medium"
        >
          {e.archived ? 'Вернуть из архива' : 'Архивировать'}
        </button>
        <button
          type="button"
          disabled={used}
          title={used ? 'Используется в тренировках' : 'Удалить упражнение'}
          onClick={() => {
            if (window.confirm(`Удалить упражнение «${e.name}»?`)) deleteExercise(e.id);
          }}
          className={
            'rounded-xl border border-border bg-card px-4 py-2.5 font-medium text-danger ' +
            (used ? 'opacity-40' : '')
          }
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
