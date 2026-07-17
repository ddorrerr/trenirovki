// Редактор тренировки. Рендерится экраном «Тренировка», когда включён
// режим редактирования. Каждая правка сохраняется сразу (по blur или
// изменению) через saveWorkout — общей кнопки «Сохранить» нет.

import { Fragment, useMemo } from 'react';
import type { Exercise, WarmupItem, Workout, WorkoutItem, WorkoutStatus } from '../../types';
import { useApp } from '../../store';
import { fmtDate } from '../../lib/dates';
import { nextExerciseId, nextItemId } from '../../lib/ids';
import { linesToSubNotes, parseSetsReps, parseWeight } from './parse';
import ExerciseCombobox from './ExerciseCombobox';
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

const STATUS_OPTIONS: { value: WorkoutStatus; label: string }[] = [
  { value: 'planned', label: 'запланирована' },
  { value: 'done', label: 'выполнена' },
];

export default function WorkoutEditor({ workout }: { workout: Workout }) {
  const { exercises, saveWorkout, deleteWorkout, saveExercise, setEditMode } = useApp();

  const patch = (p: Partial<Workout>) => saveWorkout({ ...workout, ...p });

  const patchItem = (id: string, p: Partial<WorkoutItem>) =>
    saveWorkout({
      ...workout,
      items: workout.items.map((it) => (it.id === id ? { ...it, ...p } : it)),
    });

  /* Тип тренировки — фиксированный список (все тренировки full body).
     Если у тренировки уже стоит нестандартное значение, показываем и его,
     чтобы ничего молча не потерять. */
  const typeOptions = useMemo(() => {
    const base = [
      { value: '', label: '—' },
      { value: 'с тренером', label: 'с тренером' },
      { value: 'сама', label: 'сама' },
    ];
    const cur = workout.type ?? '';
    if (cur && !base.some((o) => o.value === cur)) base.push({ value: cur, label: cur });
    return base;
  }, [workout.type]);

  /* --- Разминка --------------------------------------------------------- */

  const patchWarmup = (i: number, p: Partial<WarmupItem>) =>
    patch({ warmup: workout.warmup.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  const addWarmup = () => patch({ warmup: [...workout.warmup, { text: '', videoUrl: null }] });

  const removeWarmup = (i: number) => patch({ warmup: workout.warmup.filter((_, j) => j !== i) });

  /* --- Упражнения ------------------------------------------------------- */

  /* Редактор работает с тем же порядком, что и режим чтения: по order.
     После любого перемещения order перенумеровывается в 1..n — это заодно
     чинит импортированные тренировки с дублями и «перепутанным» order. */
  const sortedItems = useMemo(
    () => [...workout.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [workout.items],
  );

  const moveItem = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= sortedItems.length) return;
    const items = [...sortedItems];
    [items[index], items[j]] = [items[j], items[index]];
    saveWorkout({ ...workout, items: items.map((it, i) => ({ ...it, order: i + 1 })) });
  };

  const removeItem = (item: WorkoutItem) => {
    const ex = exercises.find((e) => e.id === item.exerciseId);
    const name = ex?.name || item.nameRaw || 'без названия';
    if (!window.confirm(`Убрать упражнение «${name}» из тренировки?`)) return;
    saveWorkout({ ...workout, items: workout.items.filter((it) => it.id !== item.id) });
  };

  /** Пустая позиция; вставляется в указанное место списка (index = 0..n) */
  const addItemAt = (index: number) => {
    const id = nextItemId(
      workout.id,
      workout.items.map((it) => it.id),
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
    saveWorkout({ ...workout, items: items.map((it, i) => ({ ...it, order: i + 1 })) });
  };

  const addItem = () => addItemAt(sortedItems.length);

  /** «создать новое» из комбобокса: сохраняем упражнение и сразу назначаем */
  const createExercise = (item: WorkoutItem, name: string) => {
    const ex: Exercise = {
      id: nextExerciseId(exercises.map((e) => e.id)),
      name: name.trim() || 'Новое упражнение',
      aliases: [],
      videoUrl: null,
      tags: [],
      archived: false,
    };
    saveExercise(ex);
    patchItem(item.id, { exerciseId: ex.id, nameRaw: ex.name });
  };

  const removeWorkout = () => {
    if (!window.confirm(`Удалить тренировку от ${fmtDate(workout.date)}? Это действие нельзя отменить.`))
      return;
    deleteWorkout(workout.id);
  };

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-muted">
        Все изменения сохраняются автоматически — отдельной кнопки «Сохранить» нет.
      </p>

      {/* --- Шапка --------------------------------------------------------- */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Тренировка</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <TextField
            label="Дата"
            type="date"
            value={workout.date}
            onCommit={(v) => {
              if (v) patch({ date: v });
            }}
          />
          <SelectField
            label="Тип"
            value={workout.type ?? ''}
            options={typeOptions}
            onCommit={(v) => patch({ type: v || null })}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Название"
            value={workout.title ?? ''}
            placeholder="необязательно"
            onCommit={(v) => patch({ title: v.trim() || null })}
          />
          <SelectField
            label="Статус"
            value={workout.status}
            options={STATUS_OPTIONS}
            onCommit={(v) => patch({ status: v as WorkoutStatus })}
          />
        </div>
        <div className="mt-3">
          <TextAreaField
            label="Заметки тренера"
            value={workout.notes}
            placeholder="общие заметки к тренировке"
            onCommit={(v) => patch({ notes: v })}
          />
        </div>
      </section>

      {/* --- Разминка ------------------------------------------------------ */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Разминка</h2>
        <div className="mt-3">
          <TextField
            label="Видео разминки (ссылка)"
            type="url"
            value={workout.warmupVideoUrl ?? ''}
            placeholder="https://…"
            onCommit={(v) => patch({ warmupVideoUrl: v.trim() || null })}
          />
        </div>
        {workout.warmup.length > 0 && (
          <ul className="mt-3 space-y-3">
            {workout.warmup.map((wu, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-3">
                    <TextAreaField
                      label={`Пункт ${i + 1}`}
                      value={wu.text}
                      placeholder="- вращение бедра…"
                      onCommit={(v) => patchWarmup(i, { text: v })}
                    />
                    <TextField
                      label="Видео (ссылка)"
                      type="url"
                      value={wu.videoUrl ?? ''}
                      placeholder="https://…"
                      onCommit={(v) => patchWarmup(i, { videoUrl: v.trim() || null })}
                    />
                  </div>
                  <IconBtn label="Убрать пункт" danger onClick={() => removeWarmup(i)}>
                    <IconX />
                  </IconBtn>
                </div>
              </li>
            ))}
          </ul>
        )}
        {workout.warmup.length === 0 && (
          <p className="mt-3 text-sm text-muted">Разминки пока нет.</p>
        )}
        <button
          type="button"
          onClick={addWarmup}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-medium"
        >
          <IconPlus size={16} /> Пункт разминки
        </button>
      </section>

      {/* --- Упражнения ---------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Упражнения</h2>
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
        {workout.items.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted">
            Упражнений пока нет — добавь первое.
          </p>
        )}
        <button
          type="button"
          onClick={addItem}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg"
        >
          <IconPlus size={16} /> Упражнение
        </button>
      </section>

      {/* --- Готово: выйти из режима редактирования ------------------------- */}
      <button
        type="button"
        onClick={() => setEditMode(false)}
        className="w-full rounded-xl bg-accent px-4 py-2.5 text-lg font-semibold text-accent-fg"
      >
        Готово
      </button>

      {/* --- Опасная зона --------------------------------------------------- */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-danger">Опасная зона</h2>
        <button
          type="button"
          onClick={removeWorkout}
          className="mt-3 w-full rounded-xl border border-border bg-card px-4 py-2.5 font-semibold text-danger"
        >
          Удалить тренировку
        </button>
      </section>
    </div>
  );
}

/* --- Тонкая кнопка «вставить сюда» между карточками ---------------------- */

function InsertSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Вставить упражнение сюда"
      title="Вставить упражнение сюда"
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
  const subNotes = item.subNotes ?? [];
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
        <IconBtn label="Выше" disabled={index === 0} onClick={() => move(index, -1)}>
          <IconUp />
        </IconBtn>
        <IconBtn label="Ниже" disabled={index === total - 1} onClick={() => move(index, 1)}>
          <IconDown />
        </IconBtn>
        <IconBtn label="Убрать упражнение" danger onClick={() => remove(item)}>
          <IconX />
        </IconBtn>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <TextField
          label="Подходы×повторы"
          value={item.setsReps?.raw ?? ''}
          placeholder="3х12"
          onCommit={(v) => patchItem(item.id, { setsReps: parseSetsReps(v) })}
        />
        <TextField
          label="Вес"
          value={item.weight?.raw ?? ''}
          placeholder="27.5 кг"
          onCommit={(v) => patchItem(item.id, { weight: parseWeight(v) })}
        />
        <TextField
          label="ПВР"
          value={item.pvr ?? ''}
          placeholder="напр. 2-3"
          onCommit={(v) => patchItem(item.id, { pvr: v.trim() || null })}
        />
        <TextField
          label="Отдых, мин"
          value={item.rest ?? ''}
          placeholder="1.5"
          onCommit={(v) => patchItem(item.id, { rest: v.trim() || null })}
        />
      </div>

      <div className="mt-3 space-y-3">
        <TextField
          label="Темп"
          value={item.tempo ?? ''}
          placeholder="напр. спуск 2-3 сек"
          onCommit={(v) => patchItem(item.id, { tempo: v.trim() || null })}
        />
        <TextAreaField
          label="Разминочные подходы"
          value={item.warmupSets ?? ''}
          placeholder="напр. 1х10 без веса"
          onCommit={(v) => patchItem(item.id, { warmupSets: v.trim() ? v : null })}
        />
        <TextAreaField
          label="Примечание тренера"
          value={item.ptNote ?? ''}
          onCommit={(v) => patchItem(item.id, { ptNote: v.trim() ? v : null })}
        />
        <TextField
          label="Запрос тренера"
          value={item.ptRequest ?? ''}
          placeholder="напр. жду видео сбоку"
          onCommit={(v) => patchItem(item.id, { ptRequest: v.trim() || null })}
        />
        <TextField
          label="Видео (ссылка)"
          type="url"
          value={item.videoUrl ?? ''}
          placeholder="https://…"
          onCommit={(v) => patchItem(item.id, { videoUrl: v.trim() || null })}
        />
        <TextAreaField
          label="Подпункты (каждый с новой строки)"
          value={subNotes.map((s) => s.text).join('\n')}
          placeholder="- напряжение стоп"
          onCommit={(v) => patchItem(item.id, { subNotes: linesToSubNotes(v, subNotes) })}
        />
      </div>
    </article>
  );
}
