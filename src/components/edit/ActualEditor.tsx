import { useState } from 'react';
import type { Actual, ActualSet, WorkoutItem } from '../../types';
import { actualFromSets } from '../../lib/actual';
import { useT } from '../../i18n';
import { TextField } from './ui';

const number = (value: string, integer = false): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 && (!integer || Number.isInteger(parsed)) ? parsed : null;
};

/** Results are staged in the same draft as plan edits, never written on opening. */
export default function ActualEditor({ item, onChange }: { item: WorkoutItem; onChange: (actual: Actual | null) => void }) {
  const { t } = useT();
  const [perSet, setPerSet] = useState(!!item.actual?.perSet?.length);
  const [rows, setRows] = useState<ActualSet[]>(item.actual?.perSet ?? [{ weight: null, reps: null }]);
  const actual = item.actual;
  const patch = (change: Partial<Actual>) => {
    const next = { weight: null, sets: null, reps: null, text: '', ...actual, ...change };
    const { perSet: _drop, ...single } = next;
    onChange(single.weight == null && single.sets == null && single.reps == null && !single.text ? null : single);
  };
  const updateRows = (next: ActualSet[]) => { setRows(next); onChange(actualFromSets(next, actual?.text)); };
  const usePlan = () => {
    if (item.perSetPlan?.length) {
      const next = item.perSetPlan.map((set) => ({ weight: number(set.weight), reps: number(set.reps, true) }));
      setPerSet(true); updateRows(next);
    } else {
      setPerSet(false);
      onChange({ weight: item.weight?.value ?? null, sets: item.setsReps?.sets ?? null,
        reps: item.setsReps?.reps ?? null, text: actual?.text ?? '' });
    }
  };
  return (
    <section aria-label={t.actions.resultSection} className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-semibold">{t.actions.resultSection}</h3>
      <p className="mt-1 text-sm text-muted">{t.actions.resultHint}</p>
      {perSet ? <div className="mt-3 space-y-2">
        {rows.map((row, index) => <div key={index} className="grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-end gap-2">
          <span className="py-3 text-center text-sm text-muted">{index + 1}</span>
          <TextField label={t.item.weightKg} value={row.weight == null ? '' : String(row.weight)} inputMode="decimal"
            onCommit={(value) => updateRows(rows.map((set, i) => i === index ? { ...set, weight: number(value) } : set))} />
          <TextField label={t.item.reps} value={row.reps == null ? '' : String(row.reps)} inputMode="numeric"
            onCommit={(value) => updateRows(rows.map((set, i) => i === index ? { ...set, reps: number(value, true) } : set))} />
          <button type="button" disabled={rows.length === 1} aria-label={t.item.removeSetAria(index + 1)}
            onClick={() => updateRows(rows.filter((_, i) => i !== index))}
            className="h-11 rounded-lg text-muted disabled:opacity-40">×</button>
        </div>)}
        <button type="button" onClick={() => setRows([...rows, { weight: null, reps: null }])}
          className="min-h-11 rounded-lg px-2 text-sm font-semibold text-accent">+ {t.item.addSet}</button>
      </div> : <div className="mt-3 grid grid-cols-3 gap-3">
        <TextField label={t.item.weightKg} value={actual?.weight == null ? '' : String(actual.weight)} inputMode="decimal"
          onCommit={(value) => patch({ weight: number(value) })} />
        <TextField label={t.item.sets} value={actual?.sets == null ? '' : String(actual.sets)} inputMode="numeric"
          onCommit={(value) => patch({ sets: number(value, true) })} />
        <TextField label={t.item.reps} value={actual?.reps == null ? '' : String(actual.reps)} inputMode="numeric"
          onCommit={(value) => patch({ reps: number(value, true) })} />
      </div>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <button type="button" onClick={() => {
          if (!perSet) {
            const next = actual?.perSet ?? Array.from({ length: Math.min(20, Math.max(1, actual?.sets ?? 1)) },
              () => ({ weight: actual?.weight ?? null, reps: actual?.reps ?? null }));
            setRows(next);
          } else if (actual?.perSet) patch({});
          setPerSet(!perSet);
        }} className="min-h-11 text-sm font-medium text-accent">{perSet ? t.item.perSetOff : t.item.perSetOn}</button>
        <button type="button" onClick={usePlan} className="min-h-11 text-sm font-medium text-accent">{t.actions.resultAsPlanned}</button>
        {actual && <button type="button" onClick={() => { onChange(null); setRows([{ weight: null, reps: null }]); }}
          className="min-h-11 text-sm font-medium text-muted">{t.actions.clearResult}</button>}
      </div>
    </section>
  );
}
