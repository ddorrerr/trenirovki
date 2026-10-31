import { useApp } from '../store';
import { locale, useT } from '../i18n';
import { fmtDateShort, todayISO } from '../lib/dates';
import { cycleMemo } from '../lib/cycle';
import { CycleRing } from './CycleVisual';

export default function CycleSummary({ date = todayISO(), compact = false }: { date?: string; compact?: boolean }) {
  const { cycle, navigate } = useApp();
  const { t } = useT();
  const memo = cycleMemo(cycle, date, todayISO());
  if (!memo && !compact) return null;
  const countdown = memo?.mode === 'ovulationSoon' || memo?.mode === 'periodSoon';
  const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const detail = !memo ? t.cycle.setup : memo.mode === 'update' ? t.cycle.updateHint
    : memo.mode === 'ovulationSoon' ? t.cycle.untilOvulation
    : memo.mode === 'periodSoon' ? t.cycle.untilPeriod
    : memo.mode === 'ovulation' ? t.cycle.ovulationShort
    : memo.mode === 'period' ? memo.mark === 'period' ? t.cycle.periodShort : t.cycle.periodForecastShort
    : t.cycle.fromStart;
  const secondary = !memo ? t.cycle.setupHint : memo.mode === 'update' ? ''
    : memo.mode === 'ovulation' ? `${shortDate(memo.ovulationStart)} – ${shortDate(memo.ovulationEnd)}`
    : memo.mode === 'ovulationSoon' ? `≈ ${shortDate(memo.ovulationDate)}`
    : memo.mode === 'periodSoon' ? `≈ ${shortDate(memo.expected)}`
    : memo.mode === 'day' ? `${memo.forecast ? '≈ ' : ''}${shortDate(memo.start)}` : '';
  const accessible = !memo ? t.cycle.setup : memo.mode === 'ovulationSoon' ? t.cycle.ovulationIn(memo.value)
    : memo.mode === 'periodSoon' ? t.cycle.periodIn(memo.value)
    : memo.mode === 'ovulation' ? `${t.cycle.ovulationShort}. ${fmtDateShort(memo.ovulationStart)} – ${fmtDateShort(memo.ovulationEnd)}`
    : memo.mode === 'update' ? t.cycle.updateHint : `${memo.forecast ? '≈ ' : ''}${t.cycle.day(memo.value)}. ${detail}`;
  const ring = <CycleRing day={memo?.day ?? null} value={memo?.value ?? null}
    label={countdown && memo ? t.cycle.daysLabel(memo.value) : t.cycle.dayLabel}
    length={cycle?.cycleLength ?? 28} forecast={!!countdown || memo?.forecast || memo?.mark === 'periodEstimate'}
    tone={memo?.tone} stale={memo?.mode === 'update'} symbol={memo?.mode === 'ovulation' ? 'ovulation' : undefined} />;
  return <button type="button" onClick={() => navigate('cycle')} aria-label={`${t.cycle.title}. ${accessible}`}
    className={`w-full rounded-2xl border border-border bg-card text-left transition-colors hover:bg-chip/40 active:bg-chip focus-visible:outline-2 focus-visible:outline-accent ${compact ? 'flex flex-col items-stretch justify-start p-3.5' : 'flex items-center gap-3 px-4 py-2.5'}`}>
    {!compact && ring}
    <span className="block min-w-0 flex-1">
      <span className="flex items-center justify-between gap-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        {t.cycle.title}<span aria-hidden="true" className="text-base">›</span>
      </span>
      <span className={`${compact ? 'mt-2' : 'mt-1'} flex items-center gap-2.5`}>
        {compact && ring}
        <span className="min-w-0 text-xs leading-snug">
          <span className="block font-semibold">{detail}</span>
          {secondary && <span className="mt-1 block text-muted">{secondary}</span>}
        </span>
      </span>
    </span>
  </button>;
}
