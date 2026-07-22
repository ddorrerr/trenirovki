// Ядро модели данных. Это контракт между импортом из таблицы,
// локальным хранилищем и (позже) Firestore. Не менять без миграции seed.json.

/**
 * Тип упражнения: обычное силовое / разминочное / кардио.
 * У старых записей поля нет — это значит 'main' (см. exerciseKind()).
 */
export type ExerciseKind = 'main' | 'warmup' | 'cardio';

export interface Exercise {
  id: string; // "ex-1", стабильный
  name: string; // каноническое название, напр. "Румынская тяга со штангой"
  aliases: string[]; // варианты написания из таблицы (без нумерации)
  videoUrl: string | null; // ссылка на видео техники (Drive/Yandex/YouTube)
  tags: string[]; // свободные метки
  muscles?: string[]; // группы мышц (можно несколько), см. lib/catalog.ts
  equipment?: string[]; // инвентарь (можно несколько), см. lib/catalog.ts
  kind?: ExerciseKind; // отсутствует = 'main' (для обычных не записываем)
  /**
   * true = выполняется по одной стороне за раз (на 1 ноге/руке, боковые):
   * «3х12» значит 3х12 НА КАЖДУЮ сторону — объём считается ×2.
   * Отсутствует = обе стороны сразу.
   */
  unilateral?: boolean;
  archived: boolean;
}

/** Тип упражнения с учётом старых данных без поля kind */
export function exerciseKind(e: Exercise | undefined | null): ExerciseKind {
  return e?.kind ?? 'main';
}

export interface SetsReps {
  raw: string; // как написано: "3х8", "3х30 сек", "10-15"
  sets: number | null; // распарсено, только если однозначно
  reps: number | null; // только целое число повторений; "30 сек" -> null
}

export interface Weight {
  raw: string; // как написано: "21", "4+4 кг", "5+5 ф", "пока не выполнять"
  value: number | null; // кг, только если в raw однозначное одно число
}

export interface SubNote {
  text: string; // "- напряжение стоп обучение"
  videoUrl: string | null;
}

/** Один подход в «разных подходах» факта */
export interface ActualSet {
  weight: number | null; // кг
  reps: number | null;
}

// Фактически выполненное (быстрый лог: одно поле на упражнение)
export interface Actual {
  weight: number | null; // кг; при perSet — максимум по подходам (для графика)
  sets: number | null; // при perSet — количество подходов
  reps: number | null; // при perSet — число, только если во всех подходах одинаково
  text: string; // свободный хвост, напр. "последний сет 12 раз еле-еле"
  /**
   * Разные подходы (вес×повторы по каждому), напр. [20×12, 18×10, 16×8].
   * Отсутствует = обычный лог одним числом. Агрегаты выше заполняются
   * из подходов при сохранении — старые читатели продолжают работать.
   */
  perSet?: ActualSet[];
}

/** Один подход в плане «разными подходами» (строки — как все поля плана) */
export interface PlanSet {
  weight: string; // напр. "20" или "12+12"
  reps: string; // напр. "12" или "10-12"
}

export interface WorkoutItem {
  id: string; // "<workoutId>-i<n>"
  exerciseId: string;
  nameRaw: string; // как в таблице, с нумерацией: "1.Румынская"
  order: number;
  warmupSets: string | null; // колонка "Разминка" у упражнения
  setsReps: SetsReps | null;
  weight: Weight | null;
  /**
   * План «разными подходами» (прогрессия: у каждого подхода свои вес/повторы).
   * setsReps и weight при этом держат сериализованный текст («3х12-10-8»,
   * «20-18-16») — показ и старые читатели работают без изменений.
   */
  perSetPlan?: PlanSet[];
  pvr: string | null; // колонка ПВР, напр. "4+"
  tempo: string | null;
  rest: string | null; // минуты, как в таблице ("1.0", "1.5")
  ptNote: string | null; // колонка "Примечания"
  ptRequest: string | null; // заметки тренера из колонки даты ("ВИДЕО СБОКУ ЖДУ")
  videoUrl: string | null; // ссылка именно с этой строки, если была
  subNotes: SubNote[]; // строки "-..." под упражнением
  myComment: string; // колонка "Твои комментарии" + новые комментарии в приложении
  actual: Actual | null; // null = не логировала
  done: boolean; // отметка выполнения в тренировке
  // Поля кардио-упражнений (у остальных отсутствуют; строки — как ввёл тренер)
  duration?: string | null; // длительность, напр. "30" или "20-30"
  pulseZone?: string | null; // пульсовая зона, напр. "120-140"
}

export interface WarmupItem {
  text: string;
  videoUrl: string | null;
}

export type WorkoutStatus = 'planned' | 'done';

export interface Workout {
  id: string; // "w-2025-06-13" (+ "-2" при двух в один день)
  date: string; // ISO "YYYY-MM-DD"
  title: string | null; // опционально, напр. "Ноги"
  type: string | null; // свободная метка типа тренировки
  status: WorkoutStatus;
  fatigue: number | null; // усталость в конце тренировки, 1-10
  source: 'import' | 'app';
  sourceRef: string | null; // напр. "Июнь!A15" — откуда импортировано
  notes: string; // общие заметки к тренировке (вкл. хвостовые строки блока)
  warmup: WarmupItem[]; // общая разминка в начале
  warmupVideoUrl: string | null; // ссылка со строки "Разминка"
  warmupDone?: boolean; // отметка «разминка выполнена» (в старых данных отсутствует)
  items: WorkoutItem[];
}

export interface AppData {
  exercises: Exercise[];
  workouts: Workout[];
}

// --- Хранилище ---------------------------------------------------------
// Тонкий интерфейс: локальный адаптер (seed + localStorage) сейчас,
// Firestore-адаптер при деплое.

export interface StorageAdapter {
  load(): Promise<AppData>;
  saveWorkout(w: Workout): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  saveExercise(e: Exercise): Promise<void>;
  deleteExercise(id: string): Promise<void>;
}
