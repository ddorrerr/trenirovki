// Экран «Прогресс»: сводные плитки, график веса по упражнению,
// календарь-теплокарта и усталость.

import { useApp } from '../store';
import { useT } from '../i18n';
import StatTiles from '../components/progress/StatTiles';
import WeightSection from '../components/progress/WeightSection';
import CalendarHeatmap from '../components/progress/CalendarHeatmap';
import FatigueSection from '../components/progress/FatigueSection';

export default function ProgressScreen() {
  const { loading, workouts } = useApp();
  const { t } = useT();

  if (loading) {
    return <div className="py-16 text-center text-muted">{t.loading}</div>;
  }

  if (workouts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 py-12 text-center">
        <p className="text-lg font-semibold">{t.prog.noData}</p>
        <p className="mt-1 text-muted">{t.prog.noDataSub}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StatTiles />
      <WeightSection />
      <CalendarHeatmap />
      <FatigueSection />
    </div>
  );
}
