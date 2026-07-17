import { useApp, type SyncInfo, type Tab } from './store';
import { useWakeLock } from './hooks/useWakeLock';
import TrainingScreen from './screens/TrainingScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProgressScreen from './screens/ProgressScreen';
import MenuScreen from './screens/MenuScreen';
import KeyScreen from './screens/KeyScreen';

const TABS: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { id: 'train', label: 'Тренировка', icon: (a) => <IconDumbbell active={a} /> },
  { id: 'history', label: 'История', icon: (a) => <IconList active={a} /> },
  { id: 'progress', label: 'Прогресс', icon: (a) => <IconChart active={a} /> },
  { id: 'menu', label: 'Меню', icon: (a) => <IconMenu active={a} /> },
];

export default function App() {
  const {
    loading,
    authRequired,
    sync,
    syncNow,
    changeAccessKey,
    tab,
    navigate,
    editMode,
    setEditMode,
    settings,
  } = useApp();
  useWakeLock(settings.keepAwake);

  if (authRequired) {
    return <KeyScreen />;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">Загрузка…</div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight">Тренировки</h1>
          {/* Навигация для больших экранов */}
          <nav className="ml-6 hidden gap-1 md:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(t.id)}
                className={
                  'rounded-lg px-3 py-1.5 text-sm font-medium ' +
                  (tab === t.id ? 'bg-accent-soft text-fg' : 'text-muted hover:text-fg')
                }
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SyncBadge sync={sync} onRetry={() => void syncNow()} onAuth={changeAccessKey} />
            {editMode && (
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold">
                редактирование
              </span>
            )}
            <button
              onClick={() => setEditMode(!editMode)}
              aria-label={editMode ? 'Выключить режим редактирования' : 'Включить режим редактирования'}
              title={editMode ? 'Выключить редактирование' : 'Редактировать'}
              className={
                'flex h-9 w-9 items-center justify-center rounded-lg border ' +
                (editMode
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-border bg-card text-muted hover:text-fg')
              }
            >
              <IconPencil />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 md:pb-10">
        {tab === 'train' && <TrainingScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'menu' && <MenuScreen />}
      </main>

      {/* Нижняя навигация для телефона */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(t.id)}
              className={
                'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ' +
                (tab === t.id ? 'text-accent' : 'text-muted')
              }
            >
              {t.icon(tab === t.id)}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* Индикатор синхронизации (только в GitHub-режиме) */

function SyncBadge({
  sync,
  onRetry,
  onAuth,
}: {
  sync: SyncInfo;
  onRetry: () => void;
  onAuth: () => void;
}) {
  if (sync.mode !== 'github') return null;

  const view: Record<string, { text: string; cls: string }> = {
    saved: { text: 'сохранено', cls: 'text-muted' },
    saving: { text: 'сохраняю…', cls: 'text-muted' },
    pending: { text: 'сохраняю…', cls: 'text-muted' },
    offline: { text: 'офлайн', cls: 'text-danger' },
    error: { text: 'не сохранено', cls: 'text-danger' },
    auth: { text: 'нет доступа', cls: 'text-danger' },
  };
  const v = view[sync.state] ?? view.saved;
  const retryable = sync.state === 'offline' || sync.state === 'error';
  const needsKey = sync.state === 'auth';

  return (
    <button
      onClick={needsKey ? onAuth : retryable ? onRetry : undefined}
      disabled={!retryable && !needsKey}
      title={
        needsKey
          ? 'Ключ больше не действует — нажми, чтобы ввести новый'
          : retryable
            ? 'Нажми, чтобы повторить сохранение'
            : 'Синхронизация с хранилищем'
      }
      className={'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ' + v.cls}
    >
      <span
        aria-hidden="true"
        className={
          'inline-block h-2 w-2 rounded-full ' +
          (sync.state === 'saved'
            ? 'bg-ok'
            : sync.state === 'saving' || sync.state === 'pending'
              ? 'animate-pulse bg-accent'
              : 'bg-danger')
        }
      />
      <span>{v.text}</span>
    </button>
  );
}

/* Иконки: простые инлайновые SVG, наследуют currentColor */

function IconDumbbell({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M7 8v8M4.5 9.5v5M17 8v8M19.5 9.5v5M7 12h10" />
    </svg>
  );
}

function IconList({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth={active ? 3 : 2.6} />
    </svg>
  );
}

function IconChart({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15l3.5-4 3 2.5L19 8" />
    </svg>
  );
}

function IconMenu({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3l4 4L8 20l-5 1 1-5L17 3z" />
    </svg>
  );
}
