import { describe, it, expect } from 'vitest';
import { computeFinancialState, currentLeak } from '../src/index.js';
import { baselineInput, PROTOTYPE_PLAN_ITEMS } from './fixtures/baseline.js';

describe('money leak resolution via plan items', () => {
  it('marking the HBO plan item done shrinks the leak by €8.99', () => {
    const s = computeFinancialState(baselineInput({ planState: { plan_hbo: { state: 'done' } } }));
    expect(s.leakTotal).toBeCloseTo(219 - 8.99, 2);
  });

  it('ignored counts as resolved, same as done', () => {
    const done = currentLeak(219, PROTOTYPE_PLAN_ITEMS, { plan_coffee: { state: 'done' } });
    const ignored = currentLeak(219, PROTOTYPE_PLAN_ITEMS, { plan_coffee: { state: 'ignored' } });
    expect(done).toBe(ignored);
    expect(done).toBe(184);
  });

  it('active items do not reduce the leak', () => {
    expect(currentLeak(219, PROTOTYPE_PLAN_ITEMS, { plan_coffee: { state: 'active' } })).toBe(219);
  });

  it('resolving restaurants (€90) moves the leaks pillar from 5 to 13', () => {
    const s = computeFinancialState(baselineInput({ planState: { plan_restaurants: { state: 'done' } } }));
    expect(s.leakTotal).toBe(129);
    // 129/2100 ≈ 6.1% → ≤10% band → 13
    expect(s.score.breakdown[2]!.value).toBe(13);
    expect(s.score.total).toBe(65);
  });

  it('leak never goes below zero', () => {
    expect(currentLeak(10, PROTOTYPE_PLAN_ITEMS, { plan_restaurants: { state: 'done' } })).toBe(0);
  });
});
