import { useEffect, useRef, useState } from 'react';
import { useApp, type SyncInfo, type Tab } from './store';
import { useT } from './i18n';
import { fmtDateShort, fmtWeekday } from './lib/dates';
import { useWakeLock } from './hooks/useWakeLock';
import HomeScreen from './screens/HomeScreen';
import CommentsScreen from './screens/CommentsScreen';
import TrainingScreen from './screens/TrainingScreen';
import HistoryScreen from './screens/HistoryScreen';
import LibraryScreen from './screens/LibraryScreen';
import ProgressScreen from './screens/ProgressScreen';
import MenuScreen from './screens/MenuScreen';
import KeyScreen from './screens/KeyScreen';

/* «Настройки» больше не вкладка — шестерёнка в шапке Главной.
   Подписи вкладок берутся из словаря по id (t.nav[id]) при рендере. */
const TABS: { id: Tab; icon: (active: boolean) => React.ReactNode }[] = [
  { id: 'home', icon: (a) => <IconHome active={a} /> },
  { id: 'train', icon: (a) => <IconDumbbell active={a} /> },
  { id: 'history', icon: (a) => <IconHistory active={a} /> },
  { id: 'library', icon: (a) => <IconLibrary active={a} /> },
  { id: 'progress', icon: (a) => <IconChart active={a} /> },
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
  const { t, lang } = useT();
  useWakeLock(settings.keepAwake);

  // Язык — на <html> и в заголовок вкладки (индексный скрипт делает то же до загрузки)
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.appTitle;
  }, [lang, t]);

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
        ? t.appTitle
        : t.nav[tab];

  // Экран «въезжает» со стороны, куда шагнула навигация (по порядку вкладок)
  const prevTabRef = useRef(tab);
  const slideDirRef = useRef<'left' | 'right'>('right');
  if (prevTabRef.current !== tab) {
    const order = TABS.map((t) => t.id);
    // «Настройки» и «Комментарии» вне нижней навигации — считаем их «дальними»:
    // вход к ним ощущается шагом вперёд, возврат — шагом назад
    const pos = (t: Tab) => {
      const i = order.indexOf(t);
      return i < 0 ? order.length : i;
    };
    slideDirRef.current = pos(tab) >= pos(prevTabRef.current) ? 'right' : 'left';
    prevTabRef.current = tab;
  }

  if (authRequired) {
    return <KeyScreen />;
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">{t.loading}</div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {canGoBack && (
            <button
              onClick={goBack}
              aria-label={t.back}
              title={t.back}
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
            {TABS.map((tb) => (
              <button
                key={tb.id}
                onClick={() => navigate(tb.id)}
                className={
                  'rounded-lg px-3 py-1.5 text-sm ' +
                  (tab === tb.id
                    ? 'font-bold text-accent'
                    : 'font-medium text-muted hover:text-fg')
                }
              >
                {t.nav[tb.id]}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SyncBadge sync={sync} onRetry={() => void syncNow()} onAuth={changeAccessKey} />
            {tab === 'home' && (
              <button
                onClick={() => navigate('menu')}
                aria-label={t.nav.menu}
                title={t.nav.menu}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-fg"
              >
                <IconCog active={false} size={22} />
              </button>
            )}
            <button
              onClick={() => setEditMode(!editMode)}
              aria-label={editMode ? t.editMode.turnOff : t.editMode.turnOn}
              title={editMode ? t.editMode.titleOff : t.editMode.titleOn}
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
          {tab === 'comments' && <CommentsScreen />}
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
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => navigate(tb.id)}
              aria-label={t.nav[tb.id]}
              title={t.nav[tb.id]}
              aria-current={tab === tb.id ? 'page' : undefined}
              className={
                'relative flex items-center justify-center py-3 ' +
                (tab === tb.id ? 'text-accent' : 'text-muted')
              }
            >
              {tb.icon(tab === tb.id)}
              {tab === tb.id && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-accent"
                />
              )}
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
  const { t } = useT();
  if (sync.mode !== 'github') return null;

  /* Компактный вариант: в норме — только огонёк (зелёный «всё сохранено»,
     пульсирующий «сохраняю»); слово появляется лишь когда что-то не так. */
  const text = t.sync.dot[sync.state] ?? t.sync.dot.saved;
  const ok = sync.state === 'saved' || sync.state === 'saving' || sync.state === 'pending';
  const v = { text, ok };
  const retryable = sync.state === 'offline' || sync.state === 'error';
  const needsKey = sync.state === 'auth';

  return (
    <button
      onClick={needsKey ? onAuth : retryable ? onRetry : undefined}
      disabled={!retryable && !needsKey}
      aria-label={t.sync.aria(v.text)}
      title={needsKey ? t.sync.keyExpired : retryable ? t.sync.tapRetry(v.text) : v.text}
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
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 11.5L12 3l8.5 8.5" />
      <path d="M5.5 10v9a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-9" />
      <path d="M9.5 20.5v-6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6" />
    </svg>
  );
}

function IconDumbbell({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M3.5 8.5v7M17.5 6.5v11M20.5 8.5v7M6.5 12h11M2 12h1.5M20.5 12H22" />
    </svg>
  );
}

/* Циферблат с круговой стрелкой назад — «перемотка» истории */
function IconHistory({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7.5V12l3.5 2" />
    </svg>
  );
}

function IconLibrary({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 6h11M9.5 12h11M9.5 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function IconChart({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
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
