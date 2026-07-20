import { describe, it, expect } from 'vitest';
import { computeSafePace, daysLeftInMonth, futureValue } from '../src/index.js';

describe('safe pace status bands', () => {
  const base = { income: 2100, expenses: 1340, activeSubsTotal: 86.33, housingFixed: 482.4, reservedForGoals: 0 };

  it('good when variable spend fits the budget', () => {
    expect(computeSafePace(base).status).toBe('good');
  });

  it('tight when up to 15% over, over beyond that', () => {
    // budget 1111.27; spend 1200 → expenses = 1200 + fixed 568.73
    expect(computeSafePace({ ...base, expenses: 568.73 + 1200 }).status).toBe('tight');
    expect(computeSafePace({ ...base, expenses: 568.73 + 1290 }).status).toBe('over');
  });

  it('empty when there is no income', () => {
    expect(computeSafePace({ ...base, income: 0 }).status).toBe('empty');
  });

  it('budget never goes negative', () => {
    const p = computeSafePace({ ...base, reservedForGoals: 5000 });
    expect(p.monthlyVariableBudget).toBe(0);
    expect(p.weeklyPace).toBe(0);
  });
});

describe('calendar helpers', () => {
  it('days left counts today (demo clock 2026-06-01 → 30)', () => {
    expect(daysLeftInMonth(new Date(2026, 5, 1))).toBe(30);
    expect(daysLeftInMonth(new Date(2026, 5, 30))).toBe(1);
    expect(daysLeftInMonth(new Date(2026, 1, 28))).toBe(1); // Feb 2026, non-leap
  });
});

describe('future value (savings calculator)', () => {
  it('zero rate degenerates to simple accumulation', () => {
    expect(futureValue(100, 1, 0)).toBe(1200);
  });

  it('matches the prototype 10-year 7% projection', () => {
    const r = 0.07 / 12;
    const expected = (100 * (Math.pow(1 + r, 120) - 1)) / r;
    expect(futureValue(100, 10, 0.07)).toBeCloseTo(expected, 10);
    expect(futureValue(100, 10, 0.07)).toBeGreaterThan(17000);
  });
});
