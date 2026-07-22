// Сводка факта с «разными подходами» — общий кусочек для чипов карточки,
// строк «прошлый раз» и «Последние разы» в библиотеке.

import type { Actual } from '../types';

/** «12-10-8» из чисел; одинаковые схлопываются в одно; null при пропусках */
function joinNums(xs: (number | null)[]): string | null {
  if (xs.some((x) => x == null)) return null;
  const nums = xs as number[];
  return new Set(nums).size === 1 ? String(nums[0]) : nums.join('-');
}

/**
 * Текстовая сводка perSet: count подходов, weights «20-18-16», reps «12-10-8»
 * (weights/reps = null, если в каких-то подходах не заполнено).
 * null — факт без разных подходов.
 */
export function perSetSummary(
  a: Actual | null | undefined,
): { count: number; weights: string | null; reps: string | null } | null {
  const ps = a?.perSet;
  if (!ps || ps.length === 0) return null;
  return {
    count: ps.length,
    weights: joinNums(ps.map((s) => s.weight)),
    reps: joinNums(ps.map((s) => s.reps)),
  };
}
