// Все русские строки интерфейса, сгруппированы по экранам.
// Тип словаря выводится из ЭТОГО файла (Dict = typeof ru) — en.ts обязан
// повторить структуру один в один, иначе не соберётся typecheck.
// Значения данных (названия упражнений, «Ноги», «с тренером») тут не живут:
// они хранятся по-русски в данных, а для показа переводятся в catalog.*.

import type { ExerciseKind } from '../types';
import type { EquivForms } from './lang';

/** «5 упражнений», «2 раза», … — русские формы множественного числа */
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word =
    m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}

/** «1,8» — ровно один знак после запятой */
const fmt1 = (x: number) =>
  x.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const ru = {
  appTitle: 'Тренировки',
  loading: 'Загрузка…',
  back: 'Назад',
  open: 'Открыть',
  close: 'Закрыть',
  cancel: 'Отмена',
  create: 'Создать',
  save: 'Сохранить',
  kg: 'кг',
  min: 'мин',

  /** Понедельник — первым, как во всей раскладке недели */
  weekdaysShort: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],

  nav: {
    home: 'Главная',
    train: 'Тренировка',
    history: 'История',
    library: 'Библиотека',
    progress: 'Прогресс',
    menu: 'Настройки',
    comments: 'Комментарии',
  },

  status: { done: 'выполнена', planned: 'запланирована', active: 'идёт' },

  counted: {
    workouts: (n: number) => plural(n, 'тренировка', 'тренировки', 'тренировок'),
    exercises: (n: number) => plural(n, 'упражнение', 'упражнения', 'упражнений'),
    entries: (n: number) => plural(n, 'запись', 'записи', 'записей'),
    times: (n: number) => plural(n, 'раз', 'раза', 'раз'),
  },

  /** «усталость 7» / «усталость 7/10» — в чипах и превью */
  fatigueN: (n: number) => `усталость ${n}`,
  fatigueN10: (n: number) => `усталость ${n}/10`,

  /** Значения из данных показываем как есть (данные и так по-русски) */
  catalog: {
    muscle: (v: string) => v,
    equip: (v: string) => v,
    workoutType: (v: string) => v,
    exercise: (v: string) => v,
  },

  sync: {
    dot: {
      saved: 'сохранено',
      saving: 'сохраняю…',
      pending: 'сохраняю…',
      offline: 'офлайн',
      error: 'не сохранено',
      auth: 'нет доступа',
    } as Record<string, string>,
    aria: (s: string) => `Синхронизация: ${s}`,
    keyExpired: 'Ключ больше не действует — нажми, чтобы ввести новый',
    tapRetry: (s: string) => `${s} — нажми, чтобы повторить сохранение`,
  },

  editMode: {
    turnOn: 'Включить режим редактирования',
    turnOff: 'Выключить режим редактирования',
    titleOn: 'Редактировать',
    titleOff: 'Выключить редактирование',
  },

  key: {
    subtitle: 'нужен ключ доступа',
    body:
      'Ключ открывает данные тренировок в приватном хранилище и запоминается ' +
      'на этом устройстве. Получить его можно у владельца приложения.',
    label: 'Ключ доступа',
    checking: 'Проверяю…',
    submit: 'Открыть',
    errEmpty: 'Вставь ключ доступа.',
    errStored:
      'Сохранённый ключ больше не действует (мог истечь срок). Попроси новый у владельца приложения.',
    errPasted: 'Ключ не подошёл: нет доступа к данным. Проверь, что он скопирован целиком.',
    errNetwork: 'Не получилось связаться с GitHub. Проверь интернет и попробуй ещё раз.',
  },

  menu: {
    sectionMode: 'Режим',
    sectionSettings: 'Настройки',
    sectionData: 'Данные',
    sectionSync: 'Синхронизация',
    sectionAbout: 'О приложении',
    editing: 'Редактирование',
    editingSub: 'Добавление и правка тренировок — для тебя и тренера',
    keepAwake: 'Не гасить экран',
    keepAwakeSub: 'Экран не заснёт, пока открыто приложение',
    unsupported: 'Не поддерживается этим браузером',
    theme: 'Тема',
    themeSystem: 'Как в системе',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    language: 'Язык',
    backup: 'Скачать резервную копию',
    backupSub: 'JSON-файл со всеми данными',
    syncStatus: {
      saved: 'Всё сохранено',
      saving: 'Сохраняю…',
      pending: 'Есть несохранённые правки',
      offline: 'Офлайн — сохраню, когда появится сеть',
      error: 'Ошибка сохранения — попробуй обновить',
      auth: 'Нет доступа — проверь ключ',
    } as Record<string, string>,
    conflicts: (n: number) =>
      `Перезаписано параллельных правок: ${n}. Кто-то менял те же записи ` +
      'с другого устройства — осталась более поздняя версия.',
    syncNow: 'Синхронизировать сейчас',
    syncing: 'Обновляю…',
    syncNowSub: 'Досохранить правки и забрать свежие данные',
    changeKey: 'Сменить ключ доступа',
    forgetKeyConfirm: 'Забыть ключ доступа на этом устройстве?',
    aboutWorkouts: (n: number, since: string) =>
      `${plural(n, 'тренировка', 'тренировки', 'тренировок')} с ${since}`,
    aboutNoWorkouts: 'Пока нет тренировок',
    version: 'Версия',
  },

  home: {
    /* Пока имена фиксированные: Лиза — пользователь, Таня — тренер (режим
       редактирования). Если появятся другие пользователи — переедет в данные. */
    greetUser: 'Привет, Лиза!',
    greetTrainer: 'Привет, Таня!',
    heroStart: 'Начнём?',
    heroToday: 'Сегодня',
    heroTodaySub: 'была тренировка',
    dayWord: (n: number): string => {
      const m10 = n % 10;
      const m100 = n % 100;
      return m10 === 1 && m100 !== 11
        ? 'день'
        : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)
          ? 'дня'
          : 'дней';
    },
    sinceLast: 'с последней тренировки',
    weekStreak: (n: number) => `${plural(n, 'неделя', 'недели', 'недель')} подряд`,
    total: (n: number) => `${n} всего`,
    thisWeek: 'Эта неделя',
    ofN: (n: number) => `из ${n}`,
    usual: 'привычных',
    lifted: 'Поднято за прошлую',
    kgAmount: (kg: number) => `${kg.toLocaleString('ru-RU')} кг`,
    /** «≈ 3 кабана» — целое количество юнитов */
    equivInt: (f: EquivForms, n: number) => `≈ ${plural(n, f.ru.one, f.ru.few, f.ru.many)}`,
    /** «≈ 1,8 красных такси» — дробное, форма gen (падежи дробных) */
    equivFrac: (f: EquivForms, x: number) => `≈ ${fmt1(x)} ${f.ru.gen}`,
    byWeeks: 'По неделям',
    perWeek: 'тренировок в неделю',
    last7: 'За 7 дней',
    today: 'Сегодня',
    next: 'Следующая',
    last: 'Прошлая',
    newPR: 'Новый максимум',
    openWorkoutAria: (date: string) => `Открыть тренировку ${date}`,
    feedback: (date: string) => `Фидбэк Лизы · ${date}`,
    allComments: 'Все комментарии →',
    oftenMonth: 'Часто в комментариях · месяц',
    empty:
      'Пока нет ни одной тренировки — включи режим редактирования (карандаш сверху) ' +
      'и добавь первую.',
  },

  train: {
    warmup: 'Разминка',
    warmupVideo: 'Видео разминки',
    warmupDone: 'Разминка выполнена',
    warmupUndo: 'Снять отметку «разминка выполнена»',
    lockedHint: 'Тренировка завершена — отметки закрыты (замок внизу)',
    exercises: 'Упражнения',
    noItems: 'В этой тренировке пока нет упражнений.',
    finish: 'Завершить тренировку',
    locked: 'Тренировка завершена — отметки закрыты',
    unlocked: 'Отметки открыты — нажми, чтобы закрыть',
    backToPlanned: 'Вернуть в запланированные',
    trainerNotes: 'Заметки тренера',
    toLatest: 'к последней тренировке',
    prevWorkout: 'Предыдущая тренировка',
    nextWorkout: 'Следующая тренировка',
    fatigueTitle: 'Усталость после тренировки',
    fatigueAria: 'Усталость после тренировки, от 1 до 10',
    fatigueLo: '1 — легко',
    fatigueHi: '10 — умираю',
    fatigueHint: 'Сдвинь ползунок, чтобы отметить усталость.',
    fatigueClear: 'убрать отметку',
    emptyTitle: 'Пока нет ни одной тренировки',
    emptyBody:
      'Включи режим редактирования — кнопка-карандаш сверху — и добавь свою первую ' +
      'тренировку. Настройки найдёшь в «Меню».',
    emptyEnable: 'Включить редактирование',
    emptyMenu: 'Открыть меню',
    /* Компактная карточка и режим «идёт» */
    start: 'Начать тренировку',
    expandView: 'Развернуть — посмотреть подробно',
    collapseView: 'Свернуть в карточку',
    ofCount: (a: number, b: number) => `${a} из ${b}`,
    doneBlock: 'Выполнено',
    skippedLabel: 'пропущено',
    returnToList: 'Вернуть в список',
    finishConfirm: (list: string) =>
      `Не выполнено: ${list}. Отметить пропущенными и завершить тренировку?`,
    cancelStart: 'отменить начало тренировки',
  },

  item: {
    fallbackName: 'Упражнение',
    techVideo: 'Видео техники',
    markDone: 'Отметить выполненным',
    unmarkDone: 'Снять отметку «выполнено»',
    warmupSr: 'разминка',
    chipSetsReps: 'подходы × повторы',
    chipWeight: 'вес',
    chipPvrName: 'ПВР — повторы в резерве',
    pvr: (v: string) => `ПВР ${v}`,
    chipTempo: 'темп',
    chipDuration: 'длительность',
    chipPulse: 'пульсовая зона',
    chipEachSide: 'на каждую сторону',
    rest: 'отдых',
    startRest: 'Запустить таймер отдыха',
    hasMyComment: 'есть твой комментарий',
    hasPtNote: 'есть заметка тренера',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    lastTime: 'прошлый раз',
    setsShort: (n: number) => `${n} подх.`,
    repsShort: (n: number) => `${n} повт.`,
    weightPrefix: 'вес',
    noRecord: 'без записи',
    yourComment: 'Твой комментарий',
    howWasIt: 'Как прошло?',
    fact: 'Факт',
    savedFlash: 'сохранено',
    weightKg: 'Вес, кг',
    sets: 'Подходы',
    reps: 'Повторы',
    oldFactNote: (text: string) => `Заметка к факту (старая запись): ${text}`,
    /* Быстрая запись факта: долгое нажатие на чипы повторов/веса */
    logFact: 'записать факт',
    quickFactAria: 'Записать факт: вес, подходы, повторы',
    doneEditing: 'Готово',
    perSetOn: 'разные подходы',
    perSetOff: 'одним числом',
    addSet: 'подход',
    removeSetAria: (n: number) => `Убрать подход ${n}`,
    perSetWeightAria: (n: number) => `Вес в подходе ${n}, кг`,
    perSetRepsAria: (n: number) => `Повторы в подходе ${n}`,
    /* Кружки подходов в режиме «идёт» */
    setsRowLabel: 'подходы',
    setBubbleAria: (n: number) => `Подход ${n}`,
    setsDoneOf: (a: number, b: number) => `${a} из ${b} подх.`,
    skipToday: 'пропустить сегодня',
  },

  timer: {
    title: 'Отдых',
    openAria: 'Открыть таймер отдыха',
    closeAria: 'Закрыть таймер',
    plus15: '+15 сек',
    pause: 'Пауза',
    start: 'Старт',
    reset: 'Сброс',
  },

  hist: {
    emptyTitle: 'Пока нет ни одной тренировки.',
    emptyEdit: 'Создай первую кнопкой выше.',
    emptyNoEdit: 'Включи режим редактирования (карандаш сверху), чтобы добавить первую.',
    doneTitle: 'Выполнена',
    hasComments: 'Есть твои комментарии',
    deleteWorkout: 'Удалить тренировку',
    deleteConfirm: (date: string) =>
      `Удалить тренировку от ${date}? Это действие нельзя отменить.`,
  },

  cal: {
    prevMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    openWorkout: (date: string) => `Открыть тренировку ${date}`,
    heatTitle: 'Календарь',
    earlier: 'Раньше',
    later: 'Позже',
    workoutAria: (date: string) => `Тренировка ${date}`,
    legend: 'вся история по неделям — лента листается, тап покажет превью',
  },

  lib: {
    newExercise: 'Новое упражнение',
    searchPlaceholder: 'Поиск упражнения…',
    searchAria: 'Поиск упражнения',
    typeLabel: 'Тип упражнения',
    /** Чипы фильтра по типу (единый список с бейджем в строке) */
    kindFilter: { main: 'Основные', warmup: 'Разминка', cardio: 'Кардио' } as Record<
      ExerciseKind,
      string
    >,
    /** Бейдж типа в списке; у обычных бейджа нет */
    kindChip: { warmup: 'разминка', cardio: 'кардио' } as Partial<Record<ExerciseKind, string>>,
    /** Варианты в селекте типа в редакторе упражнения */
    kindOption: { main: 'Обычное', warmup: 'Разминка', cardio: 'Кардио' } as Record<
      ExerciseKind,
      string
    >,
    /** Стороны: двустороннее / одностороннее (флаг unilateral) */
    sidesLabel: 'Стороны',
    sidesFilter: { uni: 'Односторонние', both: 'Двусторонние' },
    sidesOption: { both: 'Двустороннее', uni: 'Одностороннее' },
    sidesChip: 'одностороннее',
    muscleGroup: 'Группа мышц',
    equipment: 'Инвентарь',
    empty: 'Библиотека пока пустая.',
    emptyEdit: ' Добавь первое упражнение кнопкой выше.',
    nothingFound: 'Ничего не нашлось.',
    hideArchive: 'скрыть архив',
    showArchive: (n: number) => `показать архив (${n})`,
    archiveChip: 'архив',
    usedTimes: (n: number, date: string) =>
      `${plural(n, 'раз', 'раза', 'раз')} · последний: ${date}`,
    neverUsed: 'ещё не использовалось',
    hasVideo: 'Есть видео',
    weightChart: 'График веса →',
    recent: 'Последние разы',
    notInWorkouts: 'Пока не встречалось в тренировках.',
    name: 'Название',
    videoLink: 'Видео (ссылка)',
    muscles: 'Группы мышц',
    tags: 'Метки (через запятую)',
    tagsPlaceholder: 'что-то ещё, напр. реабилитация',
    unarchive: 'Вернуть из архива',
    archive: 'Архивировать',
    delete: 'Удалить',
    usedInWorkouts: 'Используется в тренировках',
    deleteExercise: 'Удалить упражнение',
    deleteConfirm: (name: string) => `Удалить упражнение «${name}»?`,
  },

  combo: {
    pick: 'Выбрать упражнение…',
    createNamed: (name: string) => `Создать «${name}»`,
    createNew: 'Создать новое упражнение',
  },

  form: {
    newWorkout: 'Новая тренировка',
    date: 'Дата',
    fillWith: 'Чем наполнить',
    empty: 'Пустая',
    copyLast: 'Копия последней',
    copyPicked: 'Копия выбранной',
    willCopy: (date: string, count: string) => `Скопируем тренировку от ${date} (${count}).`,
    nothingToCopy: 'Копировать пока нечего.',
  },

  editor: {
    unsavedLeave: 'Есть несохранённые изменения. Выйти без сохранения?',
    discardConfirm: 'Отменить несохранённые изменения?',
    noChanges: 'Нет изменений',
    workoutSection: 'Тренировка',
    type: 'Тип',
    statusLabel: 'Статус',
    notesPlaceholder: 'общие заметки к тренировке',
    warmupVideoLink: 'Видео разминки (ссылка)',
    stepN: (n: number) => `Пункт ${n}`,
    warmupPlaceholder: '- вращение бедра…',
    removeStep: 'Убрать пункт',
    noWarmup: 'Разминки пока нет.',
    warmupRepsPlaceholder: 'напр. 1х10 или 40 секунд',
    noItemsYet: 'Упражнений пока нет — добавь первое.',
    addExercise: 'Упражнение',
    insertHere: 'Вставить упражнение сюда',
    up: 'Выше',
    down: 'Ниже',
    removeItem: 'Убрать упражнение',
    untitled: 'без названия',
    removeItemConfirm: (name: string) => `Убрать упражнение «${name}» из тренировки?`,
    warmupFieldPlaceholder: 'напр. 1х10 без веса',
    setsPlaceholder: '3',
    repsPlaceholder: '12 или 12-10',
    weightPlaceholder: '27.5 или 12+12',
    pvrLabel: 'ПВР',
    pvrPlaceholder: 'напр. 2-3',
    restMin: 'Отдых, мин',
    restPlaceholder: '1.5',
    durationMin: 'Длительность, мин',
    durationPlaceholder: '30',
    pulseZone: 'Пульсовая зона',
    pulseZonePlaceholder: 'напр. 120–140',
    tempo: 'Темп',
    tempoPlaceholder: 'напр. спуск 2-3 сек',
    technique: 'Техника (пункты с новой строки)',
    techniquePlaceholder: '- напряжение стоп',
    ptNote: 'Примечание тренера',
    ptNotePlaceholder: 'другие заметки, например — запиши видео сбоку',
  },

  prog: {
    noData: 'Пока нет данных',
    noDataSub: 'Проведи первую тренировку — и здесь появятся графики и статистика.',
    tileWorkouts: 'Тренировок',
    tileWeeks: 'Недель с начала',
    tileAvg: 'В неделю в среднем',
    tileDaysSince: 'Дней с последней',
    weightSection: 'Вес по упражнению',
    noHistory: 'Пока нет упражнений с историей — всё впереди.',
    maxWord: 'Максимум',
    lastWord: 'Последний раз',
    fewData: 'Пока мало данных по этому упражнению.',
    pickerListAria: 'Упражнения',
    chartAria: 'График веса по датам',
    fatigue: 'Усталость',
    noFatigue: 'Пока нет отметок усталости после тренировок.',
    fatigueWord: 'усталость',
    fatigueChartAria: 'Усталость по датам, шкала от 1 до 10',
  },

  comments: {
    empty: 'Пока нет ни одного комментария.',
  },

  video: 'Видео',
};
