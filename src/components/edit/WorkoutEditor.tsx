// Редактор тренировки. Рендерится экраном «Тренировка», когда включён
// режим редактирования. Каждая правка сохраняется сразу (по blur или
// изменению) в черновик; в данные попадает только по кнопке «Сохранить».

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, WarmupItem, Workout, WorkoutItem, WorkoutStatus } from '../../types';
import { useApp } from '../../store';
import { tr, useT } from '../../i18n';
import { fmtDate } from '../../lib/dates';
import { nextExerciseId, nextItemId } from '../../lib/ids';
import { linesToSubNotes, parseSetsReps, parseWeight } from './parse';
import ExerciseCombobox from './ExerciseCombobox';
import { ChevronIcon, PinIcon } from '../train/icons';
import {
  IconBtn,
  IconDown,
  IconPlus,
  IconUp,
  IconX,
  SelectField,
  TextAreaField,
  TextField,
} from './ui';

export default function WorkoutEditor({ workout }: { workout: Workout }) {
  const { exercises, saveWorkout, deleteWorkout, saveExercise, setEditMode, setDirtyGuard } =
    useApp();
  const { t } = useT();

  /* Правки копятся в черновике и попадают в данные только по «Сохранить».
     «Отмена» отбрасывает черновик. Попытка уйти с несохранёнными правками
     перехватывается через dirty guard в store (подтверждение). */
  const [draft, setDraft] = useState<Workout>(workout);
  const baseRef = useRef<Workout>(workout);

  // тренировка обновилась извне (синхронизация): чистый черновик подхватывает её
  useEffect(() => {
    setDraft((prev) =>
      JSON.stringify(prev) === JSON.stringify(baseRef.current) ? workout : prev,
    );
    baseRef.current = workout;
  }, [workout]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(workout),
    [draft, workout],
  );

  useEffect(() => {
    if (!dirty) {
      setDirtyGuard(null);
      return;
    }
    // tr() внутри замыкания: текст берётся на языке, актуальном в момент вопроса
    setDirtyGuard(() => window.confirm(tr().editor.unsavedLeave));
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      setDirtyGuard(null);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty, setDirtyGuard]);

  const save = () => {
    setDirtyGuard(null);
    saveWorkout(draft);
    setEditMode(false);
  };

  const cancel = () => {
    if (dirty && !window.confirm(t.editor.discardConfirm)) return;
    setDirtyGuard(null);
    setDraft(workout);
    setEditMode(false);
  };

  const patch = (p: Partial<Workout>) => setDraft((prev) => ({ ...prev, ...p }));

  const patchItem = (id: string, p: Partial<WorkoutItem>) =>
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...p } : it)),
    }));

  /* Тип тренировки — фиксированный список (все тренировки full body).
     Если у тренировки уже стоит нестандартное значение, показываем и его,
     чтобы ничего молча не потерять. */
  const typeOptions = useMemo(() => {
    const base = [
      { value: '', label: '—' },
      { value: 'с тренером', label: t.catalog.workoutType('с тренером') },
      { value: 'сама', label: t.catalog.workoutType('сама') },
    ];
    const cur = draft.type ?? '';
    if (cur && !base.some((o) => o.value === cur))
      base.push({ value: cur, label: t.catalog.workoutType(cur) });
    return base;
  }, [draft.type, t]);

  /* --- Разминка --------------------------------------------------------- */

  // Разминку правят редко — по умолчанию блок свёрнут, как в режиме чтения
  const [warmupOpen, setWarmupOpen] = useState(false);

  const patchWarmup = (i: number, p: Partial<WarmupItem>) =>
    patch({ warmup: draft.warmup.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  const addWarmup = () => patch({ warmup: [...draft.warmup, { text: '', videoUrl: null }] });

  const removeWarmup = (i: number) => patch({ warmup: draft.warmup.filter((_, j) => j !== i) });

  /* --- Упражнения ------------------------------------------------------- */

  /* Редактор работает с тем же порядком, что и режим чтения: по order.
     После любого перемещения order перенумеровывается в 1..n — это заодно
     чинит импортированные тренировки с дублями и «перепутанным» order. */
  const sortedItems = useMemo(
    () => [...draft.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [draft.items],
  );

  const moveItem = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= sortedItems.length) return;
    const items = [...sortedItems];
    [items[index], items[j]] = [items[j], items[index]];
    setDraft((prev) => ({ ...prev, items: items.map((it, i) => ({ ...it, order: i + 1 })) }));
  };

  const removeItem = (item: WorkoutItem) => {
    const ex = exercises.find((e) => e.id === item.exerciseId);
    const name = t.catalog.exercise(ex?.name || item.nameRaw || t.editor.untitled);
    if (!window.confirm(t.editor.removeItemConfirm(name))) return;
    setDraft((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== item.id) }));
  };

  /** Пустая позиция; вставляется в указанное место списка (index = 0..n) */
  const addItemAt = (index: number) => {
    const id = nextItemId(
      draft.id,
      draft.items.map((it) => it.id),
    );
    const item: WorkoutItem = {
      id,
      exerciseId: '',
      nameRaw: '',
      order: index + 1,
      warmupSets: null,
      setsReps: null,
      weight: null,
      pvr: null,
      tempo: null,
      rest: null,
      ptNote: null,
      ptRequest: null,
      videoUrl: null,
      subNotes: [],
      myComment: '',
      actual: null,
      done: false,
    };
    const items = [...sortedItems];
    items.splice(index, 0, item);
    setDraft((prev) => ({ ...prev, items: items.map((it, i) => ({ ...it, order: i + 1 })) }));
  };

  const addItem = () => addItemAt(sortedItems.length);

  /** «создать новое» из комбобокса: сохраняем упражнение и сразу назначаем */
  const createExercise = (item: WorkoutItem, name: string) => {
    const ex: Exercise = {
      id: nextExerciseId(exercises.map((e) => e.id)),
      name: name.trim() || t.lib.newExercise,
      aliases: [],
      videoUrl: null,
      tags: [],
      archived: false,
    };
    saveExercise(ex);
    patchItem(item.id, { exerciseId: ex.id, nameRaw: ex.name });
  };

  const removeWorkout = () => {
    if (!window.confirm(t.hist.deleteConfirm(fmtDate(draft.date)))) return;
    setDirtyGuard(null); // удаление подтверждено — черновик больше не охраняем
    deleteWorkout(draft.id);
    setEditMode(false);
  };

  return (
    <div className="space-y-4">
      {/* Панель действий: липнет под шапкой, всегда под рукой */}
      <div className="sticky top-[calc(60px+env(safe-area-inset-top))] z-10 -mx-1 flex items-center gap-2 rounded-xl border border-border bg-bg/95 p-2 backdrop-blur">
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg border border-border bg-card px-4 py-2 font-medium"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className="flex-1 rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg disabled:opacity-40"
        >
          {dirty ? t.save : t.editor.noChanges}
        </button>
      </div>

      {/* --- Шапка --------------------------------------------------------- */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t.editor.workoutSection}
        </h2>
        {/* Поле «Название» убрано из формы (в данных title остаётся) —
            для себя оно не нужно; вернём, если появятся другие клиенты. */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <TextField
            label={t.form.date}
            type="date"
            value={draft.date}
            onCommit={(v) => {
              if (v) patch({ date: v });
            }}
          />
          <SelectField
            label={t.editor.type}
            value={draft.type ?? ''}
            options={typeOptions}
            onCommit={(v) => patch({ type: v || null })}
          />
          <SelectField
            label={t.editor.statusLabel}
            value={draft.status}
            options={[
              { value: 'planned', label: t.status.planned },
              { value: 'done', label: t.status.done },
            ]}
            onCommit={(v) => patch({ status: v as WorkoutStatus })}
          />
        </div>
        <div className="mt-3">
          <TextAreaField
            label={t.train.trainerNotes}
            value={draft.notes}
            placeholder={t.editor.notesPlaceholder}
            onCommit={(v) => patch({ notes: v })}
          />
        </div>
      </section>

      {/* --- Разминка (свёрнута, как в режиме чтения — правят её редко) ----- */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <button
          type="button"
          onClick={() => setWarmupOpen((v) => !v)}
          aria-expanded={warmupOpen}
          className="flex min-h-11 w-full items-center gap-2 text-left"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t.train.warmup}
          </span>
          {draft.warmup.length > 0 && (
            <span className="text-sm text-muted">{draft.warmup.length}</span>
          )}
          <span className="text-muted">
            <ChevronIcon open={warmupOpen} size={18} />
          </span>
        </button>
        {warmupOpen && (
          <div className="anim-rise">
            <div className="mt-2">
              <TextField
                label={t.editor.warmupVideoLink}
                type="url"
                value={draft.warmupVideoUrl ?? ''}
                placeholder="https://…"
                onCommit={(v) => patch({ warmupVideoUrl: v.trim() || null })}
              />
            </div>
            {draft.warmup.length > 0 && (
              <ul className="mt-3 space-y-3">
                {draft.warmup.map((wu, i) => (
                  <li key={i} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-3">
                        <TextAreaField
                          label={t.editor.stepN(i + 1)}
                          value={wu.text}
                          placeholder={t.editor.warmupPlaceholder}
                          onCommit={(v) => patchWarmup(i, { text: v })}
                        />
                        <TextField
                          label={t.lib.videoLink}
                          type="url"
                          value={wu.videoUrl ?? ''}
                          placeholder="https://…"
                          onCommit={(v) => patchWarmup(i, { videoUrl: v.trim() || null })}
                        />
                      </div>
                      <IconBtn label={t.editor.removeStep} danger onClick={() => removeWarmup(i)}>
                        <IconX />
                      </IconBtn>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {draft.warmup.length === 0 && (
              <p className="mt-3 text-sm text-muted">{t.editor.noWarmup}</p>
            )}
            <button
              type="button"
              onClick={addWarmup}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-medium"
            >
              <IconPlus size={16} /> {t.editor.addWarmupStep}
            </button>
          </div>
        )}
      </section>

      {/* --- Упражнения ---------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t.train.exercises}
        </h2>
        {sortedItems.map((item, index) => (
          <Fragment key={item.id}>
            {/* вставка нового упражнения прямо в это место списка */}
            <InsertSlot onClick={() => addItemAt(index)} />
            <ItemEditorCard
              item={item}
              index={index}
              total={sortedItems.length}
              exercises={exercises}
              patchItem={patchItem}
              move={moveItem}
              remove={removeItem}
              createExercise={createExercise}
            />
          </Fragment>
        ))}
        {draft.items.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
            {t.editor.noItemsYet}
          </p>
        )}
        <button
          type="button"
          onClick={addItem}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg"
        >
          <IconPlus size={16} /> {t.editor.addExercise}
        </button>
      </section>

      <button
        type="button"
        onClick={removeWorkout}
        className="w-full rounded-xl border border-danger/40 bg-card px-4 py-2.5 font-semibold text-danger"
      >
        {t.hist.deleteWorkout}
      </button>
    </div>
  );
}

/* --- Тонкая кнопка «вставить сюда» между карточками ---------------------- */

function InsertSlot({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.editor.insertHere}
      title={t.editor.insertHere}
      className="-my-1 flex h-9 w-full items-center gap-2 px-2 text-muted"
    >
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
        <IconPlus size={13} />
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </button>
  );
}

/* --- Карточка одного упражнения ----------------------------------------- */
/* Название нарочно не «ItemCard» — так зовут карточку чтения в train/. */

/** «3х12-10» → поля {sets: '3', reps: '12-10'}; свободный текст целиком в reps */
function splitSetsReps(raw: string): { sets: string; reps: string } {
  const m = /^\s*(\d+)\s*[xхXХ]\s*([\s\S]*)$/.exec(raw);
  return m ? { sets: m[1], reps: m[2].trim() } : { sets: '', reps: raw.trim() };
}

function joinSetsReps(sets: string, reps: string): string {
  const s = sets.trim();
  const r = reps.trim();
  return s && r ? `${s}х${r}` : s || r;
}

interface ItemEditorCardProps {
  item: WorkoutItem;
  index: number;
  total: number;
  exercises: Exercise[];
  patchItem: (id: string, p: Partial<WorkoutItem>) => void;
  move: (index: number, dir: -1 | 1) => void;
  remove: (item: WorkoutItem) => void;
  createExercise: (item: WorkoutItem, name: string) => void;
}

function ItemEditorCard({
  item,
  index,
  total,
  exercises,
  patchItem,
  move,
  remove,
  createExercise,
}: ItemEditorCardProps) {
  const { t } = useT();
  const subNotes = item.subNotes ?? [];
  const sr = splitSetsReps(item.setsReps?.raw ?? '');
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className="mt-2.5 w-5 shrink-0 text-sm font-semibold text-muted">{index + 1}</span>
        <ExerciseCombobox
          exercises={exercises}
          value={item.exerciseId}
          onSelect={(ex) =>
            patchItem(item.id, {
              exerciseId: ex.id,
              nameRaw: ex.name,
              // ссылка на технику подтягивается из библиотеки, если своей нет
              videoUrl: item.videoUrl ?? ex.videoUrl ?? null,
            })
          }
          onCreate={(name) => createExercise(item, name)}
        />
      </div>

      <div className="mt-2 flex justify-end gap-1">
        <IconBtn label={t.editor.up} disabled={index === 0} onClick={() => move(index, -1)}>
          <IconUp />
        </IconBtn>
        <IconBtn label={t.editor.down} disabled={index === total - 1} onClick={() => move(index, 1)}>
          <IconDown />
        </IconBtn>
        <IconBtn label={t.editor.removeItem} danger onClick={() => remove(item)}>
          <IconX />
        </IconBtn>
      </div>

      {/* Порядок полей повторяет карточку чтения: разминка первой,
          примечание тренера — всегда последним. */}
      <div className="mt-2">
        <TextAreaField
          label={t.train.warmup}
          value={item.warmupSets ?? ''}
          placeholder={t.editor.warmupFieldPlaceholder}
          onCommit={(v) => patchItem(item.id, { warmupSets: v.trim() ? v : null })}
        />
      </div>

      {/* Подходы и повторы — отдельными полями (в чтении так и останется «3х12») */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <TextField
          label={t.item.sets}
          value={sr.sets}
          placeholder={t.editor.setsPlaceholder}
          onCommit={(v) => patchItem(item.id, { setsReps: parseSetsReps(joinSetsReps(v, sr.reps)) })}
        />
        <TextField
          label={t.item.reps}
          value={sr.reps}
          placeholder={t.editor.repsPlaceholder}
          onCommit={(v) => patchItem(item.id, { setsReps: parseSetsReps(joinSetsReps(sr.sets, v)) })}
        />
        <TextField
          label={t.item.weightKg}
          value={item.weight?.raw ?? ''}
          placeholder={t.editor.weightPlaceholder}
          onCommit={(v) => patchItem(item.id, { weight: parseWeight(v) })}
        />
        <TextField
          label={t.editor.pvrLabel}
          value={item.pvr ?? ''}
          placeholder={t.editor.pvrPlaceholder}
          onCommit={(v) => patchItem(item.id, { pvr: v.trim() || null })}
        />
        <TextField
          label={t.editor.restMin}
          value={item.rest ?? ''}
          placeholder={t.editor.restPlaceholder}
          onCommit={(v) => patchItem(item.id, { rest: v.trim() || null })}
        />
        <TextField
          label={t.editor.tempo}
          value={item.tempo ?? ''}
          placeholder={t.editor.tempoPlaceholder}
          onCommit={(v) => patchItem(item.id, { tempo: v.trim() || null })}
        />
      </div>

      <div className="mt-3 space-y-3">
        <TextAreaField
          label={t.editor.technique}
          value={subNotes.map((s) => s.text).join('\n')}
          placeholder={t.editor.techniquePlaceholder}
          onCommit={(v) => patchItem(item.id, { subNotes: linesToSubNotes(v, subNotes) })}
        />
        <TextField
          label={t.lib.videoLink}
          type="url"
          value={item.videoUrl ?? ''}
          placeholder="https://…"
          onCommit={(v) => patchItem(item.id, { videoUrl: v.trim() || null })}
        />
        <TextAreaField
          label={
            <span className="inline-flex items-center gap-1">
              <PinIcon size={13} /> {t.editor.ptNote}
            </span>
          }
          value={item.ptNote ?? ''}
          placeholder={t.editor.ptNotePlaceholder}
          onCommit={(v) => patchItem(item.id, { ptNote: v.trim() ? v : null })}
        />
      </div>
    </article>
  );
}
