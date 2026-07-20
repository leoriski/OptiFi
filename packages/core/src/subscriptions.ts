import type { Subscription } from './types.js';

/** Total monthly cost of subscriptions still being paid (anything not cancelled). */
export function activeSubsTotal(subs: Subscription[]): number {
  return subs
    .filter((s) => s.userStatus !== 'cancelled')
    .reduce((a, b) => a + (b.price || 0), 0);
}

export function countByStatus(subs: Subscription[], status: Subscription['userStatus']): number {
  return subs.filter((s) => s.userStatus === status).length;
}
