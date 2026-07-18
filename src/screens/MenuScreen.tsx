// Экран «Меню»: режим редактирования, настройки, данные, о приложении.

import { useId, useState, type ReactNode } from 'react';
import { useApp, type Theme } from '../store';
import { wakeLockSupported } from '../hooks/useWakeLock';
import { downloadBackup } from '../lib/backup';
import { fmtDate } from '../lib/dates';
import { plural } from '../components/edit/ui';

const SYNC_LABEL: Record<string, string> = {
  saved: 'Всё сохранено',
  saving: 'Сохраняю…',
  pending: 'Есть несохранённые правки',
  offline: 'Офлайн — сохраню, когда появится сеть',
  error: 'Ошибка сохранения — попробуй обновить',
  auth: 'Нет доступа — проверь ключ',
};

export default function MenuScreen() {
  const {
    exercises,
    workouts,
    editMode,
    setEditMode,
    settings,
    setSettings,
    sync,
    syncNow,
    changeAccessKey,
  } = useApp();
  const supported = wakeLockSupported();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  };

  const workoutsLine = workouts.length
    ? `${plural(workouts.length, 'тренировка', 'тренировки', 'тренировок')} с ${fmtDate(workouts[0].date)}`
    : 'Пока нет тренировок';
  const exercisesLine = plural(exercises.length, 'упражнение', 'упражнения', 'упражнений');

  return (
    <div className="space-y-6">
      <Section title="Режим">
        <ToggleRow
          title="Редактирование"
          subtitle="Добавление и правка тренировок — для тебя и тренера"
          checked={editMode}
          onChange={setEditMode}
        />
      </Section>

      <Section title="Настройки">
        <ToggleRow
          title="Не гасить экран"
          subtitle="Экран не заснёт, пока открыто приложение"
          note={supported ? undefined : 'Не поддерживается этим браузером'}
          checked={settings.keepAwake}
          disabled={!supported}
          onChange={(v) => setSettings({ keepAwake: v })}
        />
        <ThemeRow value={settings.theme} onChange={(theme) => setSettings({ theme })} />
      </Section>

      <Section title="Данные">
        <button
          type="button"
          onClick={() => downloadBackup({ exercises, workouts })}
          className="flex min-h-14 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-bg"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Скачать резервную копию</span>
            <span className="mt-0.5 block text-sm text-muted">JSON-файл со всеми данными</span>
          </span>
          <span className="shrink-0 text-muted" aria-hidden="true">
            <IconDownload />
          </span>
        </button>
      </Section>

      {sync.mode === 'github' && (
        <Section title="Синхронизация">
          <div className="px-4 py-3.5">
            <p className="text-sm text-muted">{SYNC_LABEL[sync.state] ?? sync.state}</p>
            {sync.conflicts > 0 && (
              <p className="mt-1 text-sm text-muted">
                Перезаписано параллельных правок: {sync.conflicts}. Кто-то менял те же записи
                с другого устройства — осталась более поздняя версия.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="flex min-h-14 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-bg disabled:opacity-60"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {refreshing ? 'Обновляю…' : 'Синхронизировать сейчас'}
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                Досохранить правки и забрать свежие данные
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Забыть ключ доступа на этом устройстве?')) changeAccessKey();
            }}
            className="flex min-h-14 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-bg"
          >
            <span className="min-w-0 flex-1 font-medium">Сменить ключ доступа</span>
          </button>
        </Section>
      )}

      <Section title="О приложении">
        <div className="space-y-1 px-4 py-3.5 text-sm text-muted">
          <p>{workoutsLine}</p>
          <p>{exercisesLine}</p>
          <p>Версия 0.23.0</p>
        </div>
      </Section>
    </div>
  );
}

/* --- Тема оформления ---------------------------------------------------- */

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];

function ThemeRow({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="px-4 py-3.5">
      <span className="block font-medium">Тема</span>
      <div
        role="radiogroup"
        aria-label="Тема оформления"
        className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl bg-bg p-1"
      >
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={
              'min-h-9 rounded-lg px-1 text-sm font-medium transition-colors ' +
              (value === o.value ? 'bg-card shadow-sm' : 'text-muted')
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --- Строительные блоки ------------------------------------------------ */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

function ToggleRow({
  title,
  subtitle,
  note,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  subtitle?: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const labelId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-bg disabled:cursor-not-allowed"
    >
      <span className="min-w-0 flex-1">
        <span id={labelId} className={'block font-medium' + (disabled ? ' text-muted' : '')}>
          {title}
        </span>
        {subtitle && <span className="mt-0.5 block text-sm text-muted">{subtitle}</span>}
        {note && <span className="mt-1 block text-sm text-muted">{note}</span>}
      </span>
      {/* Визуальный переключатель */}
      <span
        aria-hidden="true"
        className={
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ' +
          (checked ? 'bg-accent' : 'bg-border') +
          (disabled ? ' opacity-50' : '')
        }
      >
        <span
          className={
            'absolute left-1 top-1 h-5 w-5 rounded-full bg-card shadow transition-transform duration-200' +
            (checked ? ' translate-x-5' : '')
          }
        />
      </span>
    </button>
  );
}

/* --- Иконки ------------------------------------------------------------ */

function IconDownload() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

