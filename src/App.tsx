import { useEffect, useState } from 'react';
import { useApp, type SyncInfo, type Tab } from './store';
import { fmtDateShort, fmtWeekday } from './lib/dates';
import { useWakeLock } from './hooks/useWakeLock';
import TrainingScreen from './screens/TrainingScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProgressScreen from './screens/ProgressScreen';
import MenuScreen from './screens/MenuScreen';
import KeyScreen from './screens/KeyScreen';

const TABS: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { id: 'train', label: 'Тренировка', icon: (a) => <IconDumbbell active={a} /> },
  { id: 'history', label: 'История', icon: (a) => <IconHistory active={a} /> },
  { id: 'progress', label: 'Прогресс', icon: (a) => <IconChart active={a} /> },
  { id: 'menu', label: 'Настройки', icon: (a) => <IconCog active={a} /> },
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
    canGoBack,
    goBack,
    editMode,
    setEditMode,
    settings,
    currentWorkout,
  } = useApp();
  useWakeLock(settings.keepAwake);

  // На экране «Тренировка» при прокрутке показываем в шапке дату тренировки,
  // чтобы всегда было видно, где находишься.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 130);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const headerDate =
    tab === 'train' && scrolled && currentWorkout
      ? `${fmtDateShort(currentWorkout.date)}, ${fmtWeekday(currentWorkout.date)}`
      : null;

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
          {canGoBack && (
            <button
              onClick={goBack}
              aria-label="Назад"
              title="Назад"
              className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:text-fg"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h1 className="min-w-0 truncate text-lg font-bold tracking-tight">
            {headerDate ?? 'Тренировки'}
          </h1>
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

      {/* Нижняя навигация для телефона: только иконки */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(t.id)}
              aria-label={t.label}
              title={t.label}
              aria-current={tab === t.id ? 'page' : undefined}
              className={
                'flex items-center justify-center py-3 ' +
                (tab === t.id ? 'text-accent' : 'text-muted')
              }
            >
              {t.icon(tab === t.id)}
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
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M6.5 7v10M3.5 9v6M17.5 7v10M20.5 9v6M6.5 12h11" />
    </svg>
  );
}

function IconHistory({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function IconChart({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15l3.5-4 3 2.5L19 8" />
    </svg>
  );
}

function IconCog({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
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
