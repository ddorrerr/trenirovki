import type { Workout, WorkoutItem } from '../types';

function stripPinnedLines(note: string | null): string | null {
  const text = (note ?? '').split('\n').filter((line) => !line.trim().startsWith('📌')).join('\n');
  return text.trim() ? text : null;
}

/** A repeat carries the programme, never the previous session's results. */
export function newWorkoutDraft(id: string, date: string, source: Workout | null = null): Workout {
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  return {
    id, date, title: source?.title ?? null,
    type: weekday === 3 ? 'с тренером' : weekday === 0 || weekday === 1 ? 'сама' : null,
    status: 'planned', startedAt: null, fatigue: null, warmupDone: false,
    source: 'app', sourceRef: null, notes: source ? stripPinnedLines(source.notes) ?? '' : '',
    warmup: source?.warmup.map((item) => ({ ...item })) ?? [],
    warmupVideoUrl: source?.warmupVideoUrl ?? null,
    items: source?.items.map((item, index) => ({
      ...structuredClone(item),
      id: `${id}-i${index + 1}`, order: index + 1,
      ptNote: stripPinnedLines(item.ptNote), ptRequest: null,
      myComment: '', actual: null, done: false, skipped: false, setsDone: 0,
    })) ?? [],
  };
}

/** Apply only draft changes; keep results or remote edits received while editing. */
export function mergeWorkoutDraft(base: Workout, draft: Workout, latest: Workout): Workout {
  const merged = { ...latest };
  for (const key of Object.keys(draft) as (keyof Workout)[]) {
    if (key !== 'items' && JSON.stringify(base[key]) !== JSON.stringify(draft[key])) {
      Object.assign(merged, { [key]: draft[key] });
    }
  }
  const baseItems = new Map(base.items.map((item) => [item.id, item]));
  const latestItems = new Map(latest.items.map((item) => [item.id, item]));
  merged.items = draft.items.flatMap((item) => {
    const original = baseItems.get(item.id);
    if (!original) return [item];
    const current = latestItems.get(item.id);
    if (!current) return []; // don't resurrect an item deleted elsewhere
    const next = { ...current };
    for (const key of Object.keys(item) as (keyof WorkoutItem)[]) {
      if (JSON.stringify(original[key]) !== JSON.stringify(item[key])) {
        Object.assign(next, { [key]: item[key] });
      }
    }
    return [next];
  });
  // Keep items added elsewhere while this draft was open.
  const draftIds = new Set(draft.items.map((item) => item.id));
  merged.items.push(...latest.items.filter((item) => !baseItems.has(item.id) && !draftIds.has(item.id)));
  const orderChanged = base.items.map((item) => item.id).join('|') !== draft.items.map((item) => item.id).join('|');
  if (!orderChanged) merged.items.sort((a, b) => a.order - b.order);
  merged.items = merged.items.map((item, index) => ({ ...item, order: index + 1 }));
  return merged;
}
