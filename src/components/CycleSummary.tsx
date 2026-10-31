import { useApp } from '../store';
import { locale, useT } from '../i18n';
import { fmtDateShort, todayISO } from '../lib/dates';
import { cycleSummary } from '../lib/cycle';
import { CycleRing, CycleSymbol } from './CycleVisual';

export default function CycleSummary({ date = todayISO(), compact = false }: { date?: string; compact?: boolean }) {
  const { cycle, navigate } = useApp();
  const { t } = useT();
  const summary = cycleSummary(cycle, date, todayISO());
  if (!summary && !compact) return null;
  const needsUpdate = summary && (summary.overdue || summary.stale);
  const mark = needsUpdate ? null : summary?.mark ?? 'periodEstimate';
  const detail = !summary ? t.cycle.setupHint : needsUpdate ? t.cycle.updateHint
    : summary.mark === 'period' ? t.cycle.periodShort
    : summary.mark === 'periodEstimate' ? t.cycle.periodForecastShort
    : summary.mark === 'ovulation' ? t.cycle.ovulationShort
    : `≈ ${new Date(`${summary.expected}T00:00:00Z`).toLocaleDateString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
  const accessibleDetail = summary && !summary.mark && !needsUpdate ? t.cycle.nextPeriod(fmtDateShort(summary.expected)) : detail;
  const ring = <CycleRing day={summary?.day ?? null} label={t.cycle.dayLabel} length={cycle?.cycleLength ?? 28} forecast={summary?.forecast} stale={!!needsUpdate} />;
  const note = <span className="flex items-center gap-1 text-xs leading-tight text-muted">
    {summary && mark && <CycleSymbol mark={mark} className="h-3.5 w-3.5 shrink-0" />}
    <span>{detail}</span>
  </span>;
  return <button type="button" onClick={() => navigate('cycle')}
    aria-label={`${t.cycle.title}. ${summary ? `${summary.forecast ? '≈ ' : ''}${t.cycle.day(summary.day)}` : t.cycle.setup}. ${accessibleDetail}`}
    className={`w-full rounded-2xl border border-border bg-card text-left transition-colors hover:bg-chip/40 active:bg-chip focus-visible:outline-2 focus-visible:outline-accent ${compact ? 'flex flex-col items-stretch justify-start p-3.5' : 'flex items-center gap-3 px-4 py-2.5'}`}>
    {!compact && ring}
    <span className="block min-w-0 flex-1">
      <span className="flex items-center justify-between gap-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        {t.cycle.title}<span aria-hidden="true" className="text-base">›</span>
      </span>
      <span className={`${compact ? 'mt-2' : 'mt-1'} flex items-center gap-2.5`}>
        {compact && ring}
        <span className="min-w-0">
          {!summary && <span className="mb-1 block text-xs font-semibold">{t.cycle.setup}</span>}
          {note}
        </span>
      </span>
    </span>
  </button>;
}
