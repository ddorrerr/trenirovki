import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { useT } from '../i18n';
import { fmtDate, todayISO } from '../lib/dates';
import { defaultCycle, sortedPeriods, updatePeriod, validCycle } from '../lib/cycle';
import type { PeriodRecord } from '../types';

export default function CycleScreen() {
  const { cycle, saveCycle, setDirtyGuard } = useApp();
  const { t } = useT();
  const initial = cycle ?? defaultCycle();
  const [cycleLength, setCycleLength] = useState(String(initial.cycleLength));
  const [periodLength, setPeriodLength] = useState(String(initial.periodLength));
  const [showOvulation, setShowOvulation] = useState(initial.showOvulation);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const history = cycle ? [...sortedPeriods(cycle)].reverse() : [];
  const today = todayISO();
  const input = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg px-3 py-2 text-base text-fg';
  useEffect(() => {
    const leave = () => window.confirm(t.cycle.discard);
    setDirtyGuard(dirty ? leave : null);
    const unload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    return () => { setDirtyGuard(null); window.removeEventListener('beforeunload', unload); };
  }, [dirty, setDirtyGuard, t]);
  const changed = () => { setDirty(true); setSaved(false); setError(''); };
  const choose = (record: PeriodRecord | null) => {
    if (dirty && !window.confirm(t.cycle.discard)) return;
    setCycleLength(String((cycle ?? defaultCycle()).cycleLength));
    setPeriodLength(String((cycle ?? defaultCycle()).periodLength));
    setShowOvulation((cycle ?? defaultCycle()).showOvulation);
    setStart(record?.start ?? ''); setEnd(record?.end ?? ''); setEditing(record?.start ?? null);
    setDirty(false); setSaved(false); setError('');
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'start' }));
  };
  const save = () => {
    const draft = { ...(cycle ?? defaultCycle()), cycleLength: Number(cycleLength), periodLength: Number(periodLength), showOvulation };
    if (!validCycle(draft)) { setError(t.cycle.invalidLengths); return; }
    if ((!start && !draft.periods.length) || start > today || end > today || (!start && end)) { setError(t.cycle.invalidDates); return; }
    const next = start ? updatePeriod(draft, { start, end: end || null }, editing) : draft;
    if (!next) { setError(t.cycle.invalidDates); return; }
    saveCycle(next); setEditing(start || null); setDirty(false); setError(''); setSaved(true);
  };
  return <div className="space-y-5">
    <p className="text-sm leading-relaxed text-muted">{t.cycle.sharedHint}</p>
    {!!cycle && history.length > 0 && <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <h2 className="font-bold">{t.cycle.history} <span className="ml-1 text-sm font-medium text-muted">{history.length}</span></h2>
        <button type="button" onClick={() => choose(null)} className="min-h-11 text-sm font-semibold text-accent">{t.cycle.newRecord}</button>
      </div>
      {(showAllHistory ? history : history.slice(0, 3)).map(record => <div key={record.start} className="flex items-center border-t border-border">
        <button type="button" onClick={() => choose(record)} className="min-h-14 min-w-0 flex-1 px-4 py-3 text-left text-sm">
          <span className="flex items-center justify-between gap-2 font-semibold"><span>{fmtDate(record.start)}{record.end ? ` — ${fmtDate(record.end)}` : ''}</span><span aria-hidden="true" className="text-muted">›</span></span>
          {!record.end && <span className="text-xs text-muted">{t.cycle.startOnly}</span>}
        </button>
        <button type="button" disabled={dirty} aria-label={t.cycle.deleteRecord(fmtDate(record.start))}
          onClick={() => { if (window.confirm(t.cycle.deleteConfirm)) { saveCycle({ ...cycle, periods: cycle.periods.filter(p => p.start !== record.start) }); if (editing === record.start) { setStart(''); setEnd(''); setEditing(null); } } }}
          className="min-h-11 min-w-11 px-3 text-muted disabled:opacity-40">×</button>
      </div>)}
      {history.length > 3 && <button type="button" aria-expanded={showAllHistory} onClick={() => setShowAllHistory(value => !value)} className="min-h-11 w-full border-t border-border px-4 text-sm font-semibold text-accent">{showAllHistory ? t.cycle.hideHistory : t.cycle.showHistory(history.length)}</button>}
    </section>}
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); save(); }} className="scroll-mt-20 space-y-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{editing ? t.cycle.editPeriod : t.cycle.addPeriod}</h2>
        {editing ? <button type="button" onClick={() => choose(null)} className="min-h-11 text-sm font-semibold text-accent">{t.cycle.newRecord}</button>
          : <button type="button" onClick={() => { setStart(today); changed(); }} className="min-h-11 text-sm font-semibold text-accent">{t.cycle.startedToday}</button>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 text-sm font-medium">{t.cycle.start}<input type="date" value={start} max={today} onChange={(e) => { setStart(e.target.value); changed(); }} className={input} /></label>
        <label className="min-w-0 text-sm font-medium">{t.cycle.end}<input type="date" value={end} min={start || undefined} max={today} onChange={(e) => { setEnd(e.target.value); changed(); }} className={input} /></label>
      </div>
      <p className="text-xs leading-relaxed text-muted">{t.cycle.endHint}</p>
      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
        <label className="text-sm font-medium"><span className="block">{t.cycle.cycleLength}</span><input type="number" inputMode="numeric" min="15" max="90" required value={cycleLength} onChange={(e) => { setCycleLength(e.target.value); changed(); }} className={input} /></label>
        <label className="text-sm font-medium"><span className="block">{t.cycle.periodLength}</span><input type="number" inputMode="numeric" min="1" max="14" required value={periodLength} onChange={(e) => { setPeriodLength(e.target.value); changed(); }} className={input} /></label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={showOvulation} onChange={(e) => { setShowOvulation(e.target.checked); changed(); }} className="h-5 w-5 accent-accent" />{t.cycle.showOvulation}</label>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer py-2 font-medium">{t.cycle.predictionDetails}</summary>
        <p className="pt-1 leading-relaxed">{t.cycle.predictionHint}</p>
      </details>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {saved && <p role="status" className="text-sm text-accent">{t.cycle.updated}</p>}
      <button type="submit" disabled={!dirty} className="min-h-12 w-full rounded-xl bg-accent px-4 font-semibold text-accent-fg disabled:opacity-50">{t.save}</button>
    </form>
  </div>;
}
