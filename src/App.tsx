import { useEffect, useRef, useState } from 'react';
import { useApp, type SyncInfo, type Tab } from './store';
import { fmtDateShort, fmtWeekday } from './lib/dates';
import { useWakeLock } from './hooks/useWakeLock';
import HomeScreen from './screens/HomeScreen';
import TrainingScreen from './screens/TrainingScreen';
import HistoryScreen from './screens/HistoryScreen';
import LibraryScreen from './screens/LibraryScreen';
import ProgressScreen from './screens/ProgressScreen';
import MenuScreen from './screens/MenuScreen';
import KeyScreen from './screens/KeyScreen';

/* «Настройки» больше не вкладка — шестерёнка в шапке Главной */
const TABS: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: (a) => <IconHome active={a} /> },
  { id: 'train', label: 'Тренировка', icon: (a) => <IconDumbbell active={a} /> },
  { id: 'history', label: 'История', icon: (a) => <IconHistory active={a} /> },
  { id: 'library', label: 'Библиотека', icon: (a) => <IconLibrary active={a} /> },
  { id: 'progress', label: 'Прогресс', icon: (a) => <IconChart active={a} /> },
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

  // Тема из настроек: атрибут на <html> включает CSS-переопределение,
  // meta theme-color подгоняем, чтобы системная плашка совпадала с фоном.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    const bg: Record<string, string> = { light: '#f4f6f5', dark: '#0d1110' };
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      const own = m.media.includes('dark') ? bg.dark : bg.light;
      m.content = settings.theme === 'system' ? own : bg[settings.theme];
    });
  }, [settings.theme]);

  // В шапке — не имя приложения, а где ты находишься. На «Тренировке» сверху
  // дата и так крупно видна, поэтому в шапку она приходит только при прокрутке.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 130);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const title =
    tab === 'train' && scrolled && currentWorkout
      ? `${fmtDateShort(currentWorkout.date)}, ${fmtWeekday(currentWorkout.date)}`
      : tab === 'home'
        ? 'Тренировки'
        : tab === 'menu'
          ? 'Настройки'
          : (TABS.find((t) => t.id === tab)?.label ?? 'Тренировка');

  // Экран «въезжает» со стороны, куда шагнула навигация (по порядку вкладок)
  const prevTabRef = useRef(tab);
  const slideDirRef = useRef<'left' | 'right'>('right');
  if (prevTabRef.current !== tab) {
    const order = TABS.map((t) => t.id);
    slideDirRef.current =
      order.indexOf(tab) >= order.indexOf(prevTabRef.current) ? 'right' : 'left';
    prevTabRef.current = tab;
  }

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
          {/* На десктопе разделы называет навигация — вместо заголовка «логотип» */}
          <h1 className="min-w-0 truncate text-lg font-bold tracking-tight md:sr-only">
            {title}
          </h1>
          <span className="hidden shrink-0 text-accent md:flex" aria-hidden="true">
            <IconDumbbell active />
          </span>
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
            {tab === 'home' && (
              <button
                onClick={() => navigate('menu')}
                aria-label="Настройки"
                title="Настройки"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-fg"
              >
                <IconCog active={false} size={22} />
              </button>
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

      <main className="mx-auto max-w-3xl overflow-x-clip px-4 pb-28 pt-4 md:pb-10">
        <div key={tab} className={slideDirRef.current === 'right' ? 'anim-screen-right' : 'anim-screen-left'}>
          {tab === 'home' && <HomeScreen />}
          {tab === 'train' && <TrainingScreen />}
          {tab === 'history' && <HistoryScreen />}
          {tab === 'library' && <LibraryScreen />}
          {tab === 'progress' && <ProgressScreen />}
          {tab === 'menu' && <MenuScreen />}
        </div>
      </main>

      {/* Нижняя навигация для телефона: только иконки */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
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

  /* Компактный вариант: в норме — только огонёк (зелёный «всё сохранено»,
     пульсирующий «сохраняю»); слово появляется лишь когда что-то не так. */
  const view: Record<string, { text: string; ok: boolean }> = {
    saved: { text: 'сохранено', ok: true },
    saving: { text: 'сохраняю…', ok: true },
    pending: { text: 'сохраняю…', ok: true },
    offline: { text: 'офлайн', ok: false },
    error: { text: 'не сохранено', ok: false },
    auth: { text: 'нет доступа', ok: false },
  };
  const v = view[sync.state] ?? view.saved;
  const retryable = sync.state === 'offline' || sync.state === 'error';
  const needsKey = sync.state === 'auth';

  return (
    <button
      onClick={needsKey ? onAuth : retryable ? onRetry : undefined}
      disabled={!retryable && !needsKey}
      aria-label={`Синхронизация: ${v.text}`}
      title={
        needsKey
          ? 'Ключ больше не действует — нажми, чтобы ввести новый'
          : retryable
            ? `${v.text} — нажми, чтобы повторить сохранение`
            : v.text
      }
      className={
        'flex min-h-9 items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium ' +
        (v.ok ? 'text-muted' : 'text-danger')
      }
    >
      <span
        aria-hidden="true"
        className={
          'inline-block h-2.5 w-2.5 rounded-full ' +
          (sync.state === 'saved'
            ? 'bg-ok'
            : sync.state === 'saving' || sync.state === 'pending'
              ? 'animate-pulse bg-accent'
              : 'bg-danger')
        }
      />
      {!v.ok && <span>{v.text}</span>}
    </button>
  );
}

/* Иконки: простые инлайновые SVG, наследуют currentColor */

/* Иконки навигации — тот же набор, что в утверждённом макете Главной */

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 11.5L12 3l8.5 8.5" />
      <path d="M5.5 10v9a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-9" />
      <path d="M9.5 20.5v-6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6" />
    </svg>
  );
}

function IconDumbbell({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M3.5 8.5v7M17.5 6.5v11M20.5 8.5v7M6.5 12h11M2 12h1.5M20.5 12H22" />
    </svg>
  );
}

/* Циферблат с круговой стрелкой назад — «перемотка» истории */
function IconHistory({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7.5V12l3.5 2" />
    </svg>
  );
}

function IconLibrary({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 6h11M9.5 12h11M9.5 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
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

function IconCog({ active, size = 26 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round">
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
