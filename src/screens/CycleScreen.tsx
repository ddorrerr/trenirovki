import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { useT } from '../i18n';
import { fmtDate, todayISO } from '../lib/dates';
import { cycleAddDays, defaultCycle, sortedPeriods, updatePeriod, usualPeriodEnd, validCycle, validCycleDate } from '../lib/cycle';
import type { PeriodRecord } from '../types';

type View = 'log' | 'history' | 'settings';

export default function CycleScreen() {
  const { cycle, saveCycle, setDirtyGuard } = useApp();
  const { t } = useT();
  const initial = cycle ?? defaultCycle();
  const [view, setView] = useState<View>('log');
  const [cycleLength, setCycleLength] = useState(String(initial.cycleLength));
  const [periodLength, setPeriodLength] = useState(String(initial.periodLength));
  const [showOvulation, setShowOvulation] = useState(initial.showOvulation);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const history = cycle ? [...sortedPeriods(cycle)].reverse() : [];
  const today = todayISO();
  const input = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg px-3 py-2 text-base text-fg';
  useEffect(() => {
    setDirtyGuard(dirty ? () => window.confirm(t.cycle.discard) : null);
    const unload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    return () => { setDirtyGuard(null); window.removeEventListener('beforeunload', unload); };
  }, [dirty, setDirtyGuard, t]);
  // Fresh sync may update defaults while this screen is open, but never a dirty form.
  useEffect(() => {
    if (dirty) return;
    const current = cycle ?? defaultCycle();
    setCycleLength(String(current.cycleLength)); setPeriodLength(String(current.periodLength)); setShowOvulation(current.showOvulation);
  }, [cycle, dirty]);
  const changed = () => { setDirty(true); setSaved(false); setError(''); };
  const choose = (nextView: View, record: PeriodRecord | null = null) => {
    if (dirty && !window.confirm(t.cycle.discard)) return;
    setStart(record?.start ?? ''); setEnd(record ? record.end ?? usualPeriodEnd(record.start, initial.periodLength) : ''); setEditing(record?.start ?? null);
    setView(nextView); setDirty(false); setSaved(false); setError('');
  };
  const changeStart = (value: string) => {
    // Preserve an explicitly chosen duration when moving the start date.
    const length = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1 : initial.periodLength;
    setStart(value); setEnd(validCycleDate(value) && length > 0 ? cycleAddDays(value, length - 1) : usualPeriodEnd(value, initial.periodLength)); changed();
  };
  const save = () => {
    if (view === 'settings') {
      const draft = { ...(cycle ?? defaultCycle()), cycleLength: Number(cycleLength), periodLength: Number(periodLength), showOvulation };
      if (!validCycle(draft)) { setError(t.cycle.invalidLengths); return; }
      saveCycle(draft);
    } else {
      if (!start || !end || start > today) { setError(t.cycle.invalidDates); return; }
      const next = updatePeriod(cycle ?? defaultCycle(), { start, end }, editing);
      if (!next) { setError(t.cycle.invalidDates); return; }
      saveCycle(next); setStart(''); setEnd(''); setEditing(null);
    }
    setDirty(false); setError(''); setSaved(true);
  };
  const length = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1 : null;
  const showForm = view === 'log' || editing != null;
  return <div className="space-y-4">
    <nav aria-label={t.cycle.title} className="flex gap-1 rounded-xl bg-chip p-1">
      {(['log', 'history', 'settings'] as const).map(value => <button type="button" key={value} aria-current={view === value ? 'page' : undefined}
        onClick={() => choose(value)} className={'min-h-11 min-w-0 flex-1 rounded-lg px-2 text-sm font-semibold ' + (view === value ? 'bg-card text-fg' : 'text-muted')}>
        {value === 'log' ? t.cycle.log : value === 'history' ? t.cycle.history : t.menu.sectionSettings}
      </button>)}
    </nav>
    {saved && <p role="status" className="text-sm font-semibold text-accent">{t.cycle.updated}</p>}
    {showForm && <form onSubmit={event => { event.preventDefault(); save(); }} className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{editing ? t.cycle.editPeriod : t.cycle.addPeriod}</h2>
        {editing && <button type="button" onClick={() => choose('history')} className="min-h-11 text-sm text-muted">{t.cancel}</button>}
      </div>
      {!editing && <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => changeStart(today)} aria-pressed={start === today} className={"min-h-11 rounded-xl px-3 text-sm font-semibold " + (start === today ? "bg-accent-soft text-accent" : "bg-chip")}>{t.cycle.startedToday}</button>
        <button type="button" onClick={() => changeStart(cycleAddDays(today, -1))} aria-pressed={start === cycleAddDays(today, -1)} className={"min-h-11 rounded-xl px-3 text-sm font-semibold " + (start === cycleAddDays(today, -1) ? "bg-accent-soft text-accent" : "bg-chip")}>{t.cycle.startedYesterday}</button>
      </div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 text-sm font-medium">{t.cycle.start}<input type="date" required value={start} max={today} onChange={event => changeStart(event.target.value)} className={input} /></label>
        <label className="min-w-0 text-sm font-medium">{end > today ? t.cycle.expectedEnd : t.cycle.end}<input type="date" required value={end} min={start || undefined} onChange={event => { setEnd(event.target.value); changed(); }} className={input} /></label>
      </div>
      <p className="text-sm leading-relaxed text-muted">{t.cycle.endHint}{length != null && length > 0 ? ` ${t.cycle.durationDays(length)}` : ''}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={!dirty} className="min-h-12 w-full rounded-xl bg-accent px-4 font-semibold text-accent-fg disabled:opacity-50">{t.save}</button>
    </form>}
    {view === 'history' && !editing && <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <h2 className="px-4 py-4 font-bold">{t.cycle.history}</h2>
      {!history.length && <p className="px-4 pb-4 text-sm text-muted">{t.cycle.noHistory}</p>}
      {history.map(record => <div key={record.start} className="flex items-center border-t border-border">
        <button type="button" onClick={() => choose('history', record)} className="min-h-14 min-w-0 flex-1 px-4 py-3 text-left text-sm">
          <span className="flex items-center justify-between gap-2 font-semibold"><span>{fmtDate(record.start)}{record.end ? ` — ${fmtDate(record.end)}` : ''}</span><span aria-hidden="true" className="text-muted">›</span></span>
          {(!record.end || record.end > today) && <span className="text-xs text-muted">{record.end ? t.cycle.expectedEnd : t.cycle.startOnly}</span>}
        </button>
        <button type="button" aria-label={t.cycle.deleteRecord(fmtDate(record.start))}
          onClick={() => { if (cycle && window.confirm(t.cycle.deleteConfirm)) saveCycle({ ...cycle, periods: cycle.periods.filter(p => p.start !== record.start) }); }}
          className="min-h-11 min-w-11 px-3 text-muted">×</button>
      </div>)}
    </section>}
    {view === 'settings' && <form onSubmit={event => { event.preventDefault(); save(); }} className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-bold">{t.cycle.usualLengths}</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 text-sm font-medium">{t.cycle.cycleLength}<input type="number" inputMode="numeric" min="15" max="90" required value={cycleLength} onChange={event => { setCycleLength(event.target.value); changed(); }} className={input} /></label>
        <label className="min-w-0 text-sm font-medium">{t.cycle.periodLength}<input type="number" inputMode="numeric" min="1" max="14" required value={periodLength} onChange={event => { setPeriodLength(event.target.value); changed(); }} className={input} /></label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={showOvulation} onChange={event => { setShowOvulation(event.target.checked); changed(); }} className="h-5 w-5 accent-accent" />{t.cycle.showOvulation}</label>
      <details className="text-sm text-muted"><summary className="cursor-pointer py-2 font-medium">{t.cycle.predictionDetails}</summary><p className="pt-1 leading-relaxed">{t.cycle.predictionHint}</p></details>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={!dirty} className="min-h-12 w-full rounded-xl bg-accent px-4 font-semibold text-accent-fg disabled:opacity-50">{t.save}</button>
    </form>}
    <p className="text-xs leading-relaxed text-muted">{t.cycle.sharedHint}</p>
  </div>;
}
