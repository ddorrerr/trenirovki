// Экран «Библиотека»: все упражнения с поиском и фильтрами по группам мышц
// и инвентарю. В режиме редактирования здесь же правится библиотека.
// Переехал из «Истории» (фаза 1 новой структуры вкладок, v0.13).

import { useEffect, useMemo, useState } from 'react';
import { exerciseKind, type Exercise, type ExerciseKind, type WorkoutItem } from '../types';
import { useApp } from '../store';
import { useT, type Dict } from '../i18n';
import { fmtDate, fmtDateShort } from '../lib/dates';
import { nextExerciseId } from '../lib/ids';
import { EQUIPMENT, MUSCLE_GROUPS } from '../lib/catalog';
import { splitTags } from '../components/edit/parse';
import { Chip, ChipPicker, IconPlus, SelectField, TextField, inputCls } from '../components/edit/ui';
import { BarbellIcon, FlameIcon, HeartPulseIcon, SidesIcon, VideoIcon } from '../components/train/icons';
import { equipIcon, muscleIcon } from '../components/catalogIcons';

const KIND_VALUES: ExerciseKind[] = ['main', 'warmup', 'cardio'];

/** Иконки чипов фильтра по типу — в одном стиле с группами мышц/инвентарём */
function kindIcon(kind: string, size = 15): React.ReactNode {
  if (kind === 'main') return <BarbellIcon size={size} />;
  if (kind === 'warmup') return <FlameIcon size={size} />;
  if (kind === 'cardio') return <HeartPulseIcon size={size} />;
  return null;
}

/* Экран запоминает, где ты была (раскрытое упражнение, фильтры, прокрутка),
   чтобы стрелка «назад» возвращала ровно туда же. */
const paneMemory: {
  expandedId: string | null;
  scroll: number;
  fKind: string | null;
  fSides: string | null;
  fMuscle: string | null;
  fEquip: string | null;
} = {
  expandedId: null,
  scroll: 0,
  fKind: null,
  fSides: null,
  fMuscle: null,
  fEquip: null,
};

export default function LibraryScreen() {
  const { exercises, exerciseHistory, editMode, saveExercise } = useApp();
  const { t } = useT();
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

  /* Фильтры: тип + стороны + одна группа мышц + один инвентарь
     (тап второй раз — сброс) */
  const [fKind, setFKindState] = useState<string | null>(paneMemory.fKind);
  const [fSides, setFSidesState] = useState<string | null>(paneMemory.fSides);
  const [fMuscle, setFMuscleState] = useState<string | null>(paneMemory.fMuscle);
  const [fEquip, setFEquipState] = useState<string | null>(paneMemory.fEquip);
  const setFKind = (v: string | null) => {
    paneMemory.fKind = v;
    setFKindState(v);
  };
  const setFSides = (v: string | null) => {
    paneMemory.fSides = v;
    setFSidesState(v);
  };
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
      .filter((e) => !fKind || exerciseKind(e) === fKind)
      .filter((e) => !fSides || (fSides === 'uni') === !!e.unilateral)
      .filter((e) => !fMuscle || (e.muscles ?? []).includes(fMuscle))
      .filter((e) => !fEquip || (e.equipment ?? []).includes(fEquip))
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          // в en-режиме поиск находит и по английскому названию
          t.catalog.exercise(e.name).toLowerCase().includes(q) ||
          (e.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (a.id === pinnedId) return -1;
        if (b.id === pinnedId) return 1;
        const d = (stats.get(b.id)?.count ?? 0) - (stats.get(a.id)?.count ?? 0);
        return d !== 0 ? d : a.name.localeCompare(b.name, 'ru');
      });
  }, [exercises, query, showArchive, stats, pinnedId, fKind, fSides, fMuscle, fEquip, t]);

  const addExercise = () => {
    const ex: Exercise = {
      id: nextExerciseId(exercises.map((e) => e.id)),
      name: t.lib.newExercise,
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
          <IconPlus size={16} /> {t.lib.newExercise}
        </button>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.lib.searchPlaceholder}
        aria-label={t.lib.searchAria}
        className={inputCls}
      />

      <FilterChips
        label={t.lib.typeLabel}
        options={KIND_VALUES}
        value={fKind}
        onChange={setFKind}
        tone="kind"
        icon={kindIcon}
        display={(k) => t.lib.kindFilter[k as ExerciseKind]}
      />
      <FilterChips
        label={t.lib.sidesLabel}
        options={['uni', 'both']}
        value={fSides}
        onChange={setFSides}
        tone="equip"
        icon={(v, size = 15) => (v === 'uni' ? <SidesIcon size={size} /> : null)}
        display={(v) => t.lib.sidesFilter[v as 'uni' | 'both']}
      />
      <FilterChips
        label={t.lib.muscleGroup}
        options={muscleChips}
        value={fMuscle}
        onChange={setFMuscle}
        tone="muscle"
        icon={muscleIcon}
        display={t.catalog.muscle}
      />
      <FilterChips
        label={t.lib.equipment}
        options={equipChips}
        value={fEquip}
        onChange={setFEquip}
        tone="equip"
        icon={equipIcon}
        display={t.catalog.equip}
      />

      {exercises.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted">
          {t.lib.empty}
          {editMode ? t.lib.emptyEdit : ''}
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
        <p className="py-4 text-center text-muted">{t.lib.nothingFound}</p>
      )}

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchive((v) => !v)}
          className="mx-auto block px-3 py-2 text-sm text-muted underline underline-offset-2"
        >
          {showArchive ? t.lib.hideArchive : t.lib.showArchive(archivedCount)}
        </button>
      )}
    </div>
  );
}

/* Лента чипов-фильтров: горизонтальная прокрутка до краёв экрана,
   выбран максимум один, повторный тап снимает.
   У каждой категории свой цвет: группы мышц — петроль, инвентарь — янтарь */
function FilterChips({
  label,
  options,
  value,
  onChange,
  tone,
  icon,
  display,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  tone: 'kind' | 'muscle' | 'equip';
  icon: (name: string, size?: number) => React.ReactNode;
  /** как показать значение из данных на текущем языке */
  display: (name: string) => string;
}) {
  const onCls =
    tone === 'equip'
      ? 'border-warn bg-warn-soft font-semibold text-warn-text'
      : 'border-accent bg-accent-soft font-semibold text-accent';
  const iconTint = tone === 'equip' ? 'text-warn-text' : 'text-accent';
  return (
    <div
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={label}
    >
      <div className="flex w-max gap-1.5 pb-0.5">
        {options.map((opt) => {
          const on = value === opt;
          const ic = icon(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : opt)}
              className={
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ' +
                (on ? onCls : 'border-border bg-card font-medium text-muted')
              }
            >
              {ic && <span className={on ? '' : iconTint}>{ic}</span>}
              {display(opt)}
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
  const { t } = useT();

  return (
    <li className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words text-lg font-semibold leading-snug">
              {t.catalog.exercise(e.name)}
            </span>
            {t.lib.kindChip[exerciseKind(e)] && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                {kindIcon(exerciseKind(e), 12)}
                {t.lib.kindChip[exerciseKind(e)]}
              </span>
            )}
            {e.unilateral && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2 py-0.5 text-xs font-medium text-muted">
                <SidesIcon size={12} />
                {t.lib.sidesChip}
              </span>
            )}
            {e.archived && (
              <span className="rounded-lg border border-border bg-bg px-2 py-0.5 text-xs font-medium text-muted">
                {t.lib.archiveChip}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-muted">
            {count > 0 && lastDate ? t.lib.usedTimes(count, fmtDate(lastDate)) : t.lib.neverUsed}
          </div>
        </div>
        {e.videoUrl && (
          <span className="shrink-0 text-accent" title={t.lib.hasVideo}>
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
function occurrenceSummary(it: WorkoutItem, dict: Dict): string {
  if (it.actual) {
    const parts: string[] = [];
    if (it.actual.weight != null) parts.push(`${it.actual.weight} ${dict.kg}`);
    if (it.actual.sets != null && it.actual.reps != null)
      parts.push(`${it.actual.sets}×${it.actual.reps}`);
    if (parts.length) return parts.join(' · ');
  }
  const parts: string[] = [];
  if (it.duration) parts.push(it.duration); // кардио: длительность вместо веса
  if (it.pulseZone) parts.push(it.pulseZone);
  if (it.setsReps?.raw) parts.push(it.setsReps.raw);
  if (it.weight?.raw) parts.push(`${dict.item.weightPrefix} ${it.weight.raw}`);
  return parts.join(' · ') || '—';
}

function ExerciseDetails({ e }: { e: Exercise }) {
  const { exerciseHistory, navigate, showExerciseProgress } = useApp();
  const { t } = useT();
  const tags = e.tags ?? [];
  const muscles = e.muscles ?? [];
  const equipment = e.equipment ?? [];
  const recent = useMemo(() => exerciseHistory(e.id).slice(-5).reverse(), [exerciseHistory, e.id]);

  return (
    <div className="space-y-3">
      {(muscles.length > 0 || equipment.length > 0 || e.unilateral) && (
        <div className="flex flex-wrap gap-1.5">
          {muscles.map((m) => (
            <Chip key={'m-' + m}>
              <span className="inline-flex items-center gap-1.5">
                {muscleIcon(m, 13) && <span className="text-accent">{muscleIcon(m, 13)}</span>}
                {t.catalog.muscle(m)}
              </span>
            </Chip>
          ))}
          {equipment.map((q) => (
            <Chip key={'q-' + q} muted>
              <span className="inline-flex items-center gap-1.5">
                {equipIcon(q, 13) && <span className="text-warn-text">{equipIcon(q, 13)}</span>}
                {t.catalog.equip(q)}
              </span>
            </Chip>
          ))}
          {e.unilateral && (
            <Chip muted>
              <span className="inline-flex items-center gap-1.5">
                <SidesIcon size={13} />
                {t.lib.sidesChip}
              </span>
            </Chip>
          )}
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
            <VideoIcon size={16} /> {t.item.techVideo}
          </a>
        )}
        {/* у разминки и кардио веса нет — график не предлагаем */}
        {recent.length > 0 && exerciseKind(e) === 'main' && (
          <button
            type="button"
            onClick={() => showExerciseProgress(e.id)}
            className="inline-flex items-center gap-1.5 font-medium text-accent"
          >
            {t.lib.weightChart}
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <div>
          <div className="mb-1 text-sm text-muted">{t.lib.recent}</div>
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
                    {occurrenceSummary(item, t)}
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
        <p className="text-sm text-muted">{t.lib.notInWorkouts}</p>
      )}
    </div>
  );
}

function ExerciseEditPanel({ e, used }: { e: Exercise; used: boolean }) {
  const { saveExercise, deleteExercise } = useApp();
  const { t } = useT();

  return (
    <div className="space-y-3">
      <TextField
        label={t.lib.name}
        value={e.name}
        onCommit={(v) => {
          const name = v.trim();
          if (name) saveExercise({ ...e, name });
        }}
      />
      <SelectField
        label={t.lib.typeLabel}
        value={exerciseKind(e)}
        options={KIND_VALUES.map((k) => ({ value: k, label: t.lib.kindOption[k] }))}
        onCommit={(v) =>
          // у обычных упражнений поле kind не храним (как в старых данных)
          saveExercise({ ...e, kind: v === 'main' ? undefined : (v as ExerciseKind) })
        }
      />
      <SelectField
        label={t.lib.sidesLabel}
        value={e.unilateral ? 'uni' : 'both'}
        options={[
          { value: 'both', label: t.lib.sidesOption.both },
          { value: 'uni', label: t.lib.sidesOption.uni },
        ]}
        onCommit={(v) =>
          // «обе сразу» — поле не храним, как и kind у обычных
          saveExercise({ ...e, unilateral: v === 'uni' ? true : undefined })
        }
      />
      <TextField
        label={t.lib.videoLink}
        type="url"
        value={e.videoUrl ?? ''}
        placeholder="https://…"
        onCommit={(v) => saveExercise({ ...e, videoUrl: v.trim() || null })}
      />
      <ChipPicker
        label={t.lib.muscles}
        options={MUSCLE_GROUPS}
        value={e.muscles ?? []}
        onChange={(muscles) => saveExercise({ ...e, muscles })}
        icon={muscleIcon}
        display={t.catalog.muscle}
      />
      <ChipPicker
        label={t.lib.equipment}
        options={EQUIPMENT}
        value={e.equipment ?? []}
        onChange={(equipment) => saveExercise({ ...e, equipment })}
        icon={equipIcon}
        display={t.catalog.equip}
      />
      <TextField
        label={t.lib.tags}
        value={(e.tags ?? []).join(', ')}
        placeholder={t.lib.tagsPlaceholder}
        onCommit={(v) => saveExercise({ ...e, tags: splitTags(v) })}
      />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => saveExercise({ ...e, archived: !e.archived })}
          className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 font-medium"
        >
          {e.archived ? t.lib.unarchive : t.lib.archive}
        </button>
        <button
          type="button"
          disabled={used}
          title={used ? t.lib.usedInWorkouts : t.lib.deleteExercise}
          onClick={() => {
            if (window.confirm(t.lib.deleteConfirm(t.catalog.exercise(e.name)))) deleteExercise(e.id);
          }}
          className={
            'rounded-xl border border-border bg-card px-4 py-2.5 font-medium text-danger ' +
            (used ? 'opacity-40' : '')
          }
        >
          {t.lib.delete}
        </button>
      </div>
    </div>
  );
}
