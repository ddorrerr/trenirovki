// Глобальное состояние приложения: данные, навигация, режим редактирования,
// настройки, синхронизация. Все экраны работают ТОЛЬКО через useApp() —
// прямых обращений к адаптерам хранилища в экранах быть не должно.
//
// Режимы данных:
//  - local  — seed.json + localStorage (разработка, до деплоя)
//  - github — data.json в приватном репозитории, доступ по ключу

/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppData, Exercise, StorageAdapter, Workout, WorkoutItem } from './types';
import { DATA_REPO } from './config';
import { LocalAdapter } from './storage/local';
import {
  AuthError,
  GitHubAdapter,
  clearStoredToken,
  getStoredToken,
  storeToken,
  type SyncState,
} from './storage/github';

export type Tab = 'train' | 'history' | 'progress' | 'menu';

export interface Settings {
  keepAwake: boolean;
}

export interface Occurrence {
  workout: Workout;
  item: WorkoutItem;
}

export interface SyncInfo {
  mode: 'local' | 'github';
  state: SyncState;
  pendingCount: number;
  /** Сколько чужих параллельных правок перезаписано нашими (за сессию) */
  conflicts: number;
}

const UI_KEY = 'trenirovki:ui:v1';
const RELOAD_IF_STALE_MS = 60_000;

interface UiPersist {
  editMode: boolean;
  keepAwake: boolean;
}

function readUi(): UiPersist {
  const fallback: UiPersist = { editMode: false, keepAwake: false };
  try {
    const raw = localStorage.getItem(UI_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<UiPersist>) } : fallback;
  } catch {
    return fallback;
  }
}

function writeUi(u: UiPersist): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(u));
  } catch {
    /* не критично */
  }
}

function sortWorkouts(ws: Workout[]): Workout[] {
  return [...ws].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1));
}

export interface AppContextValue {
  /** true, пока данные ещё грузятся */
  loading: boolean;

  /** GitHub-режим: нужен ключ доступа (показать экран ключа) */
  authRequired: boolean;
  /** Текст ошибки последней попытки входа (для экрана ключа) */
  authError: string | null;
  /** Проверить и применить ключ. true = успех */
  submitAccessKey: (token: string) => Promise<boolean>;
  /** Забыть ключ на этом устройстве и показать экран ключа */
  changeAccessKey: () => void;

  /** Состояние синхронизации для индикатора и меню */
  sync: SyncInfo;
  /** Досохранить очередь и перечитать данные с сервера */
  syncNow: () => Promise<void>;

  /** Все упражнения (библиотека), включая archived */
  exercises: Exercise[];
  /** Все тренировки, отсортированы по дате по возрастанию */
  workouts: Workout[];

  /** Навигация */
  tab: Tab;
  /** Какая тренировка открыта на экране «Тренировка»; null = последняя по дате */
  openWorkoutId: string | null;
  navigate: (tab: Tab, workoutId?: string | null) => void;

  /** Режим редактирования (глобальный тумблер) */
  editMode: boolean;
  setEditMode: (v: boolean) => void;

  /**
   * Защита от потери несохранённых правок: редактор регистрирует функцию,
   * которая спрашивает пользователя, можно ли уходить. null — правок нет.
   */
  setDirtyGuard: (fn: (() => boolean) | null) => void;

  /** Открыть график веса конкретного упражнения на экране «Прогресс» */
  openExerciseId: string | null;
  showExerciseProgress: (exerciseId: string) => void;

  /** Настройки (пока только «не гасить экран») */
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;

  exerciseById: (id: string) => Exercise | undefined;
  workoutById: (id: string) => Workout | undefined;
  /** Тренировка для экрана «Тренировка»: открытая или последняя по дате */
  currentWorkout: Workout | null;

  /** Запись данных: оптимистично обновляет состояние и сохраняет в фоне */
  saveWorkout: (w: Workout) => void;
  deleteWorkout: (id: string) => void;
  saveExercise: (e: Exercise) => void;
  deleteExercise: (id: string) => void;

  /** Все появления упражнения в тренировках, по дате по возрастанию */
  exerciseHistory: (exerciseId: string) => Occurrence[];
  /**
   * Последнее появление упражнения ДО указанной даты (для «прошлый раз…»).
   * excludeWorkoutId исключает текущую тренировку при совпадении дат.
   */
  lastResultBefore: (
    exerciseId: string,
    beforeDate: string,
    excludeWorkoutId?: string,
  ) => Occurrence | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncInfo>({
    mode: DATA_REPO ? 'github' : 'local',
    state: 'saved',
    pendingCount: 0,
    conflicts: 0,
  });
  const [data, setData] = useState<AppData>({ exercises: [], workouts: [] });
  const [tab, setTab] = useState<Tab>('train');
  const [openWorkoutId, setOpenWorkoutId] = useState<string | null>(null);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);
  const [ui, setUi] = useState<UiPersist>(() => readUi());

  const dirtyGuardRef = useRef<(() => boolean) | null>(null);
  const setDirtyGuard = useCallback((fn: (() => boolean) | null) => {
    dirtyGuardRef.current = fn;
  }, []);
  /** true = уходить можно (правок нет или пользователь подтвердил) */
  const canLeave = useCallback(() => !dirtyGuardRef.current || dirtyGuardRef.current(), []);

  const adapterRef = useRef<StorageAdapter | null>(null);
  const ghRef = useRef<GitHubAdapter | null>(null);
  const lastLoadAtRef = useRef(0);

  const adoptData = useCallback((d: AppData) => {
    setData({ exercises: d.exercises, workouts: sortWorkouts(d.workouts) });
    lastLoadAtRef.current = Date.now();
  }, []);

  /** Подключить GitHub-адаптер с данным токеном; при успехе — принять данные */
  const connectGitHub = useCallback(
    async (token: string, source: 'stored' | 'pasted'): Promise<boolean> => {
      if (!DATA_REPO) return false;
      const gh = new GitHubAdapter(DATA_REPO, token);
      try {
        const d = await gh.load();
        ghRef.current?.dispose();
        ghRef.current = gh;
        adapterRef.current = gh;
        gh.subscribe((s) =>
          setSync({
            mode: 'github',
            state: s.state,
            pendingCount: s.pendingCount,
            conflicts: s.conflictsOverwritten,
          }),
        );
        adoptData(d);
        setAuthRequired(false);
        setAuthError(null);
        setLoading(false);
        return true;
      } catch (e) {
        gh.dispose();
        if (e instanceof AuthError) {
          setAuthError(
            source === 'stored'
              ? 'Сохранённый ключ больше не действует (мог истечь срок). Попроси новый у владельца приложения.'
              : 'Ключ не подошёл: нет доступа к данным. Проверь, что он скопирован целиком.',
          );
        } else {
          setAuthError('Не получилось связаться с GitHub. Проверь интернет и попробуй ещё раз.');
        }
        return false;
      }
    },
    [adoptData],
  );

  /* Инициализация источника данных */
  useEffect(() => {
    let alive = true;
    if (!DATA_REPO) {
      const local = new LocalAdapter();
      adapterRef.current = local;
      local
        .load()
        .then((d) => {
          if (!alive) return;
          adoptData(d);
          setLoading(false);
        })
        .catch((e) => {
          console.error('Не удалось загрузить данные', e);
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }

    // GitHub-режим: ключ из адресной строки (#key=…) имеет приоритет.
    // Чистим хвостовую пунктуацию (мессенджеры любят приклеивать точку к ссылке)
    // и запоминаем ключ только после успешной проверки.
    const m = /[#&]key=([^&]+)/.exec(window.location.hash);
    const fromLink = m
      ? decodeURIComponent(m[1]).trim().replace(/[^A-Za-z0-9_]+$/, '')
      : null;
    if (fromLink) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    const token = fromLink || getStoredToken();
    if (!token) {
      setAuthRequired(true);
      setLoading(false);
      return;
    }
    void connectGitHub(token, fromLink ? 'pasted' : 'stored').then((ok) => {
      if (!alive) return;
      if (ok) {
        if (fromLink) storeToken(fromLink);
      } else {
        setAuthRequired(true);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
      ghRef.current?.dispose();
      ghRef.current = null;
    };
  }, [adoptData, connectGitHub]);

  /* Возврат во вкладку: досохранить очередь; перечитать, если данные залежались */
  useEffect(() => {
    if (!DATA_REPO) return;
    const onVisibility = () => {
      const gh = ghRef.current;
      if (!gh) return;
      if (document.visibilityState === 'hidden') {
        void gh.flush();
        return;
      }
      const stale = Date.now() - lastLoadAtRef.current > RELOAD_IF_STALE_MS;
      if (stale) {
        gh.reload().then(adoptData).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [adoptData]);

  const submitAccessKey = useCallback(
    async (token: string): Promise<boolean> => {
      const trimmed = token.trim();
      if (!trimmed) {
        setAuthError('Вставь ключ доступа.');
        return false;
      }
      setLoading(true);
      const ok = await connectGitHub(trimmed, 'pasted');
      if (ok) {
        storeToken(trimmed);
      } else {
        setLoading(false);
      }
      return ok;
    },
    [connectGitHub],
  );

  const changeAccessKey = useCallback(() => {
    clearStoredToken();
    ghRef.current?.dispose();
    ghRef.current = null;
    adapterRef.current = null;
    setAuthError(null);
    setAuthRequired(true);
  }, []);

  const syncNow = useCallback(async () => {
    const gh = ghRef.current;
    if (!gh) return;
    try {
      const d = await gh.reload();
      adoptData(d);
    } catch (e) {
      console.error('Синхронизация не удалась', e);
    }
  }, [adoptData]);

  /* Навигация интегрирована с историей браузера: работают «назад/вперёд»
     и жест возврата на телефоне. Каждый переход — запись в истории. */
  const tabRef = useRef<Tab>('train');
  const openIdRef = useRef<string | null>(null);
  useEffect(() => {
    tabRef.current = tab;
    openIdRef.current = openWorkoutId;
  }, [tab, openWorkoutId]);

  useEffect(() => {
    history.replaceState({ t: tabRef.current, w: openIdRef.current }, '');
    const onPop = (e: PopStateEvent) => {
      const s = e.state as { t?: Tab; w?: string | null } | null;
      if (!s?.t) return;
      if (!canLeave()) {
        // возвращаем запись истории на место — остаёмся в редакторе
        history.pushState({ t: tabRef.current, w: openIdRef.current }, '');
        return;
      }
      setTab(s.t);
      setOpenWorkoutId(s.w ?? null);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback(
    (nextTab: Tab, workoutId?: string | null) => {
      if (!canLeave()) return;
      const nextOpenId = workoutId !== undefined ? workoutId : openIdRef.current;
      const same = nextTab === tabRef.current && nextOpenId === openIdRef.current;
      setTab(nextTab);
      if (workoutId !== undefined) setOpenWorkoutId(workoutId);
      if (!same) history.pushState({ t: nextTab, w: nextOpenId }, '');
      window.scrollTo({ top: 0 });
    },
    [canLeave],
  );

  const setEditMode = useCallback(
    (v: boolean) => {
      if (!v && !canLeave()) return;
      setUi((prev) => {
        const next = { ...prev, editMode: v };
        writeUi(next);
        return next;
      });
    },
    [canLeave],
  );

  const showExerciseProgress = useCallback(
    (exerciseId: string) => {
      setOpenExerciseId(exerciseId);
      navigate('progress');
    },
    [navigate],
  );

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch };
      writeUi(next);
      return next;
    });
  }, []);

  const saveWorkout = useCallback((w: Workout) => {
    setData((prev) => {
      const rest = prev.workouts.filter((x) => x.id !== w.id);
      return { ...prev, workouts: sortWorkouts([...rest, w]) };
    });
    void adapterRef.current
      ?.saveWorkout(w)
      .catch((e) => console.error('Сохранение тренировки не удалось', e));
  }, []);

  const deleteWorkout = useCallback((id: string) => {
    setData((prev) => ({ ...prev, workouts: prev.workouts.filter((x) => x.id !== id) }));
    setOpenWorkoutId((cur) => (cur === id ? null : cur));
    void adapterRef.current
      ?.deleteWorkout(id)
      .catch((e) => console.error('Удаление тренировки не удалось', e));
  }, []);

  const saveExercise = useCallback((e: Exercise) => {
    setData((prev) => {
      const rest = prev.exercises.filter((x) => x.id !== e.id);
      return { ...prev, exercises: [...rest, e] };
    });
    void adapterRef.current
      ?.saveExercise(e)
      .catch((err) => console.error('Сохранение упражнения не удалось', err));
  }, []);

  const deleteExercise = useCallback((id: string) => {
    setData((prev) => ({ ...prev, exercises: prev.exercises.filter((x) => x.id !== id) }));
    void adapterRef.current
      ?.deleteExercise(id)
      .catch((e) => console.error('Удаление упражнения не удалось', e));
  }, []);

  const exerciseById = useCallback(
    (id: string) => data.exercises.find((e) => e.id === id),
    [data.exercises],
  );

  const workoutById = useCallback(
    (id: string) => data.workouts.find((w) => w.id === id),
    [data.workouts],
  );

  const currentWorkout = useMemo(() => {
    if (openWorkoutId) return data.workouts.find((w) => w.id === openWorkoutId) ?? null;
    return data.workouts.length ? data.workouts[data.workouts.length - 1] : null;
  }, [data.workouts, openWorkoutId]);

  const exerciseHistory = useCallback(
    (exerciseId: string): Occurrence[] => {
      const out: Occurrence[] = [];
      for (const workout of data.workouts) {
        for (const item of workout.items) {
          if (item.exerciseId === exerciseId) out.push({ workout, item });
        }
      }
      return out;
    },
    [data.workouts],
  );

  const lastResultBefore = useCallback(
    (exerciseId: string, beforeDate: string, excludeWorkoutId?: string): Occurrence | null => {
      for (let i = data.workouts.length - 1; i >= 0; i--) {
        const workout = data.workouts[i];
        if (workout.id === excludeWorkoutId) continue;
        if (workout.date > beforeDate) continue;
        // Две тренировки в один день: «прошлым разом» считаем только более
        // раннюю сессию того же дня (id той же даты сортируются по суффиксу).
        if (workout.date === beforeDate) {
          if (!excludeWorkoutId || workout.id >= excludeWorkoutId) continue;
        }
        for (const item of workout.items) {
          if (item.exerciseId === exerciseId) return { workout, item };
        }
      }
      return null;
    },
    [data.workouts],
  );

  const value: AppContextValue = {
    loading,
    authRequired,
    authError,
    submitAccessKey,
    changeAccessKey,
    sync,
    syncNow,
    exercises: data.exercises,
    workouts: data.workouts,
    tab,
    openWorkoutId,
    navigate,
    editMode: ui.editMode,
    setEditMode,
    setDirtyGuard,
    openExerciseId,
    showExerciseProgress,
    settings: { keepAwake: ui.keepAwake },
    setSettings,
    exerciseById,
    workoutById,
    currentWorkout,
    saveWorkout,
    deleteWorkout,
    saveExercise,
    deleteExercise,
    exerciseHistory,
    lastResultBefore,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp() вне <AppProvider>');
  return ctx;
}
