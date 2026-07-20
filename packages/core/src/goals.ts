import type { Goal, GoalProjection } from './types.js';

/** Whole months between two dates (calendar difference, ignores day-of-month). */
export function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Structured deadline (first of the target month), or null when unset. */
export function goalDeadline(g: Goal): Date | null {
  if (g.targetMonth !== undefined && g.targetMonth >= 1 && g.targetMonth <= 12 && g.targetYear) {
    return new Date(g.targetYear, g.targetMonth - 1, 1);
  }
  return null;
}

/**
 * Honest projection for one goal from the allocation the USER defined —
 * never assumes the whole net for a single goal. Ported from recalcAll.
 */
export function projectGoal(g: Goal, today: Date): GoalProjection {
  const alloc = g.monthlyAllocation || 0;
  const remaining = Math.max(g.targetEur - g.currentEur, 0);

  if (remaining <= 0) {
    return { alloc, remaining, state: 'done' };
  }
  if (alloc > 0) {
    const months = Math.ceil(remaining / alloc);
    const estDate = new Date(today.getFullYear(), today.getMonth() + months, 1);
    const deadline = goalDeadline(g);
    const onTrack = deadline ? estDate <= deadline : true;
    const monthsLate = deadline && !onTrack ? monthsBetween(deadline, estDate) : 0;
    return { alloc, remaining, state: 'allocated', months, estDate, deadline, onTrack, monthsLate };
  }
  return { alloc, remaining, state: 'unallocated' };
}
