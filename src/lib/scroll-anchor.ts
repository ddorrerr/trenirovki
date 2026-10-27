export interface WorkoutAnchor {
  itemId: string | null;
  offset: number;
  scrollY: number;
}

export function captureWorkoutAnchor(preferredId?: string): WorkoutAnchor {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-workout-item]')];
  const card = preferredId
    ? cards.find((element) => element.dataset.workoutItem === preferredId)
    : cards.find((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.bottom > 100 && bounds.top < window.innerHeight;
      });
  return {
    itemId: card?.dataset.workoutItem ?? null,
    offset: card ? Math.max(80, card.getBoundingClientRect().top) : 0,
    scrollY: window.scrollY,
  };
}

export function restoreWorkoutAnchor(anchor: WorkoutAnchor): void {
  const card = anchor.itemId
    ? [...document.querySelectorAll<HTMLElement>('[data-workout-item]')]
        .find((element) => element.dataset.workoutItem === anchor.itemId)
    : null;
  window.scrollTo({
    top: card ? window.scrollY + card.getBoundingClientRect().top - anchor.offset : anchor.scrollY,
    behavior: 'instant',
  });
}
