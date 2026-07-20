import type { PlanItem, PlanState } from './types.js';

/**
 * Active money leak: the base leak from the analyzed month minus every plan
 * item the user resolved (done or ignored count as resolved — acting on it or
 * consciously accepting it both settle the question).
 */
export function currentLeak(baseLeak: number, items: PlanItem[], state: PlanState): number {
  let resolved = 0;
  for (const item of items) {
    const st = state[item.id];
    if (st && (st.state === 'done' || st.state === 'ignored')) {
      resolved += item.monthlySaving;
    }
  }
  return Math.max(0, baseLeak - resolved);
}
