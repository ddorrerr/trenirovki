// Экран «История»: две вкладки — список тренировок по месяцам
// и библиотека упражнений. В режиме редактирования здесь же создаются
// новые тренировки (пустые или копии) и правится библиотека.

import { useEffect, useMemo, useState } from 'react';
import type { Exercise, Workout, WorkoutItem } from '../types';
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
import { EQUIPMENT, MUSCLE_GROUPS } from '../lib/catalog';
import { splitTags } from '../components/edit/parse';
import NewWorkoutForm from '../components/edit/NewWorkoutForm';
import {
  Chip,
  ChipPicker,
  IconCheck,
  IconComment,
  IconPlus,
  IconX,
  TextField,
  inputCls,
  plural,
} from '../components/edit/ui';
import { VideoIcon } from '../components/train/icons';

type Segment = 'workouts' | 'exercises';

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'workouts', label: 'Тренировки' },
  { id: 'exercises', label: 'Упражнения' },
];

/* Экран запоминает, где ты была (вкладка, раскрытое упражнение, фильтры,
   прокрутка), чтобы стрелка «назад» возвращала ровно туда же. */
const paneMemory: {
  seg: Segment;
  expandedId: string | null;
  scroll: number;
  fMuscle: string | null;
  fEquip: string | null;
} = {
  seg: 'workouts',
  expandedId: null,
  scroll: 0,
  fMuscle: null,
  fEquip: null,
};

export default function HistoryScreen() {
  const [seg, setSegState] = useState<Segment>(paneMemory.seg);
  const setSeg = (s: Segment) => {
    paneMemory.seg = s;
    if (s === 'workouts') paneMemory.expandedId = null;
    setSegState(s);
  };

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

/* NewWorkoutForm переехала в components/edit/NewWorkoutForm.tsx —
   теперь она нужна и «Истории», и «Тренировке» в режиме редактирования. */


/* ======================= Вкладка «Упражнения» =========================== */

function ExercisesPane() {
  const { exercises, exerciseHistory, editMode, saveExercise } = useApp();
  const [query, setQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [expandedId, setExpandedIdState] = useState<string | null>(paneMemory.expandedId);
  const setExpandedId = (v: string | null | ((cur: string | null) => string | null)) => {
    setExpandedIdState((cur) => {
      const next = typeof v === 'function' ? v(cur) : v;
      paneMemory.expandedId = next;
      return next;
    });
  };
  /** только что созданное упражнение держим наверху, пока его не свернули */
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  /* Фильтры: одна группа мышц + один инвентарь (тап по чипу второй раз — сброс) */
  const [fMuscle, setFMuscleState] = useState<string | null>(paneMemory.fMuscle);
  const [fEquip, setFEquipState] = useState<string | null>(paneMemory.fEquip);
  const setFMuscle = (v: string | null) => {
    paneMemory.fMuscle = v;
    setFMuscleState(v);
  };
  const setFEquip = (v: string | null) => {
    paneMemory.fEquip = v;
    setFEquipState(v);
  };

  /* Чипы фильтра: справочник + свои значения, встретившиеся в библиотеке */
  const muscleChips = useMemo(() => {
    const extra = new Set<string>();
    for (const e of exercises)
      for (const m of e.muscles ?? []) if (!MUSCLE_GROUPS.includes(m)) extra.add(m);
    return [...MUSCLE_GROUPS, ...[...extra].sort((a, b) => a.localeCompare(b, 'ru'))];
  }, [exercises]);
  const equipChips = useMemo(() => {
    const extra = new Set<string>();
    for (const e of exercises)
      for (const q of e.equipment ?? []) if (!EQUIPMENT.includes(q)) extra.add(q);
    return [...EQUIPMENT, ...[...extra].sort((a, b) => a.localeCompare(b, 'ru'))];
  }, [exercises]);

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
      .filter((e) => !fMuscle || (e.muscles ?? []).includes(fMuscle))
      .filter((e) => !fEquip || (e.equipment ?? []).includes(fEquip))
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
  }, [exercises, query, showArchive, stats, pinnedId, fMuscle, fEquip]);

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

      <FilterChips label="Группа мышц" options={muscleChips} value={fMuscle} onChange={setFMuscle} />
      <FilterChips label="Инвентарь" options={equipChips} value={fEquip} onChange={setFEquip} />

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

/* Лента чипов-фильтров: горизонтальная прокрутка до краёв экрана,
   выбран максимум один, повторный тап снимает */
function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={label}
    >
      <div className="flex w-max gap-1.5 pb-0.5">
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : opt)}
              className={
                'shrink-0 rounded-full border px-3 py-1.5 text-sm ' +
                (on
                  ? 'border-accent bg-accent-soft font-semibold text-accent'
                  : 'border-border bg-card font-medium text-muted')
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
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
            <VideoIcon size={18} />
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

/** Короткая сводка «что делала» по позиции: факт, иначе план */
function occurrenceSummary(it: WorkoutItem): string {
  if (it.actual) {
    const parts: string[] = [];
    if (it.actual.weight != null) parts.push(`${it.actual.weight} кг`);
    if (it.actual.sets != null && it.actual.reps != null)
      parts.push(`${it.actual.sets}×${it.actual.reps}`);
    if (parts.length) return parts.join(' · ');
  }
  const parts: string[] = [];
  if (it.setsReps?.raw) parts.push(it.setsReps.raw);
  if (it.weight?.raw) parts.push(`вес ${it.weight.raw}`);
  return parts.join(' · ') || '—';
}

function ExerciseDetails({ e }: { e: Exercise }) {
  const { exerciseHistory, navigate, showExerciseProgress } = useApp();
  const tags = e.tags ?? [];
  const muscles = e.muscles ?? [];
  const equipment = e.equipment ?? [];
  const recent = useMemo(() => exerciseHistory(e.id).slice(-5).reverse(), [exerciseHistory, e.id]);

  return (
    <div className="space-y-3">
      {(muscles.length > 0 || equipment.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {muscles.map((m) => (
            <Chip key={'m-' + m}>{m}</Chip>
          ))}
          {equipment.map((q) => (
            <Chip key={'q-' + q} muted>
              {q}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {e.videoUrl && (
          <a
            href={e.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-accent"
          >
            <VideoIcon size={16} /> Видео техники
          </a>
        )}
        {recent.length > 0 && (
          <button
            type="button"
            onClick={() => showExerciseProgress(e.id)}
            className="inline-flex items-center gap-1.5 font-medium text-accent"
          >
            График веса →
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <div>
          <div className="mb-1 text-sm text-muted">Последние разы</div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {recent.map(({ workout, item }) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate('train', workout.id)}
                  className="flex min-h-11 w-full items-center gap-3 bg-bg px-3 py-2 text-left text-sm"
                >
                  <span className="shrink-0 font-medium">{fmtDateShort(workout.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {occurrenceSummary(item)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      )}
      {recent.length === 0 && !e.videoUrl && tags.length === 0 && (
        <p className="text-sm text-muted">Пока не встречалось в тренировках.</p>
      )}
    </div>
  );
}

function ExerciseEditPanel({ e, used }: { e: Exercise; used: boolean }) {
  const { saveExercise, deleteExercise } = useApp();

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
      <ChipPicker
        label="Группы мышц"
        options={MUSCLE_GROUPS}
        value={e.muscles ?? []}
        onChange={(muscles) => saveExercise({ ...e, muscles })}
      />
      <ChipPicker
        label="Инвентарь"
        options={EQUIPMENT}
        value={e.equipment ?? []}
        onChange={(equipment) => saveExercise({ ...e, equipment })}
      />
      <TextField
        label="Метки (через запятую)"
        value={(e.tags ?? []).join(', ')}
        placeholder="что-то ещё, напр. реабилитация"
        onCommit={(v) => saveExercise({ ...e, tags: splitTags(v) })}
      />
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
