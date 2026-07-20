import type { CategoryLimits, CategoryLimitState, CategoryLimitStatus, CategorySpend } from './types.js';

/** ok: within the limit · tight: up to 10% over · over: beyond that. */
export function categoryLimitStatus(spent: number, limit: number): CategoryLimitStatus {
  if (spent <= limit) return 'ok';
  if (spent <= limit * 1.1) return 'tight';
  return 'over';
}

export interface LimitsResult {
  states: Record<string, CategoryLimitState>;
  /** Money freed IF the user meets the limits they set (sum of overshoots). */
  savingsPotential: number;
  count: number;
}

/**
 * Compare last month's spend per category to the user's ceilings. Limits on
 * categories with no spend row are ignored (mirrors the prototype, which
 * drops limits whose category is missing from ccSpending).
 */
export function computeLimits(limits: CategoryLimits, spend: CategorySpend[]): LimitsResult {
  const spentById = new Map(spend.map((r) => [r.categoryId, r.amount]));
  const states: Record<string, CategoryLimitState> = {};
  let potential = 0;
  let count = 0;

  for (const [categoryId, limit] of Object.entries(limits)) {
    if (typeof limit !== 'number' || limit < 0 || !spentById.has(categoryId)) continue;
    const spent = spentById.get(categoryId)!;
    const overBy = Math.max(0, spent - limit);
    states[categoryId] = { spent, limit, overBy, state: categoryLimitStatus(spent, limit) };
    potential += overBy;
    count++;
  }

  return { states, savingsPotential: potential, count };
}
