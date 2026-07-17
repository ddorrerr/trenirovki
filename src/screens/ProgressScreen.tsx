// Экран «Прогресс»: сводные плитки, график веса по упражнению,
// календарь-теплокарта и усталость.

import { useApp } from '../store';
import StatTiles from '../components/progress/StatTiles';
import WeightSection from '../components/progress/WeightSection';
import CalendarHeatmap from '../components/progress/CalendarHeatmap';
import FatigueSection from '../components/progress/FatigueSection';

export default function ProgressScreen() {
  const { loading, workouts } = useApp();

  if (loading) {
    return <div className="py-16 text-center text-muted">Загрузка…</div>;
  }

  if (workouts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 py-12 text-center">
        <p className="text-lg font-semibold">Пока нет данных</p>
        <p className="mt-1 text-muted">
          Проведи первую тренировку — и здесь появятся графики и статистика.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatTiles />
      <WeightSection />
      <CalendarHeatmap />
      <FatigueSection />
    </div>
  );
}
