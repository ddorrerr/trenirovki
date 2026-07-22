// Экран «Меню»: режим редактирования, настройки (тема, язык), данные, о приложении.

import { useId, useState, type ReactNode } from 'react';
import { useApp, type Theme } from '../store';
import { useT, type Dict, type Lang } from '../i18n';
import { wakeLockSupported } from '../hooks/useWakeLock';
import { downloadBackup } from '../lib/backup';
import { fmtDate } from '../lib/dates';

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
  const { t } = useT();
  const supported = wakeLockSupported();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  };

  const workoutsLine = workouts.length
    ? t.menu.aboutWorkouts(workouts.length, fmtDate(workouts[0].date))
    : t.menu.aboutNoWorkouts;
  const exercisesLine = t.counted.exercises(exercises.length);

  return (
    <div className="space-y-6">
      <Section title={t.menu.sectionMode}>
        <ToggleRow
          title={t.menu.editing}
          subtitle={t.menu.editingSub}
          checked={editMode}
          onChange={setEditMode}
        />
      </Section>

      <Section title={t.menu.sectionSettings}>
        <ToggleRow
          title={t.menu.keepAwake}
          subtitle={t.menu.keepAwakeSub}
          note={supported ? undefined : t.menu.unsupported}
          checked={settings.keepAwake}
          disabled={!supported}
          onChange={(v) => setSettings({ keepAwake: v })}
        />
        <ThemeRow t={t} value={settings.theme} onChange={(theme) => setSettings({ theme })} />
        <LangRow t={t} value={settings.lang} onChange={(lang) => setSettings({ lang })} />
      </Section>

      <Section title={t.menu.sectionData}>
        <button
          type="button"
          onClick={() => downloadBackup({ exercises, workouts })}
          className="flex min-h-14 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-bg"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t.menu.backup}</span>
            <span className="mt-0.5 block text-sm text-muted">{t.menu.backupSub}</span>
          </span>
          <span className="shrink-0 text-muted" aria-hidden="true">
            <IconDownload />
          </span>
        </button>
      </Section>

      {sync.mode === 'github' && (
        <Section title={t.menu.sectionSync}>
          <div className="px-4 py-3.5">
            <p className="text-sm text-muted">{t.menu.syncStatus[sync.state] ?? sync.state}</p>
            {sync.conflicts > 0 && (
              <p className="mt-1 text-sm text-muted">{t.menu.conflicts(sync.conflicts)}</p>
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
                {refreshing ? t.menu.syncing : t.menu.syncNow}
              </span>
              <span className="mt-0.5 block text-sm text-muted">{t.menu.syncNowSub}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t.menu.forgetKeyConfirm)) changeAccessKey();
            }}
            className="flex min-h-14 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-bg"
          >
            <span className="min-w-0 flex-1 font-medium">{t.menu.changeKey}</span>
          </button>
        </Section>
      )}

      <Section title={t.menu.sectionAbout}>
        <div className="space-y-1 px-4 py-3.5 text-sm text-muted">
          <p>{workoutsLine}</p>
          <p>{exercisesLine}</p>
          <p>{t.menu.version} 0.30.1</p>
        </div>
      </Section>
    </div>
  );
}

/* --- Тема оформления ---------------------------------------------------- */

function ThemeRow({ t, value, onChange }: { t: Dict; value: Theme; onChange: (v: Theme) => void }) {
  const options: { value: Theme; label: string }[] = [
    { value: 'system', label: t.menu.themeSystem },
    { value: 'light', label: t.menu.themeLight },
    { value: 'dark', label: t.menu.themeDark },
  ];
  return (
    <SegmentedRow label={t.menu.theme} options={options} value={value} onChange={onChange} />
  );
}

/* --- Язык интерфейса ---------------------------------------------------- */
/* Каждый язык подписан сам собой — так его найдёт и тот, кто не читает второй */

function LangRow({ t, value, onChange }: { t: Dict; value: Lang; onChange: (v: Lang) => void }) {
  const options: { value: Lang; label: string }[] = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
  ];
  return (
    <SegmentedRow label={t.menu.language} options={options} value={value} onChange={onChange} />
  );
}

/* --- Строительные блоки ------------------------------------------------ */

/** Ряд «подпись + сегментный переключатель» — общий для темы и языка */
function SegmentedRow<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div className="px-4 py-3.5">
      <span className="block font-medium">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="mt-2.5 grid gap-1 rounded-xl bg-bg p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
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
