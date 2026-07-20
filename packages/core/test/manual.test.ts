import { describe, it, expect } from 'vitest';
import { computeFinancialState, monthKey, sumManualEntries } from '../src/index.js';
import { baselineInput } from './fixtures/baseline.js';
import type { ManualEntry } from '../src/index.js';

const entries: ManualEntry[] = [
  { id: 'm1', month: '2026-06', type: 'expense', amount: 42.5, category: 'habitacao' },
  { id: 'm2', month: '2026-06', type: 'income', amount: 1500 },
  { id: 'm3', month: '2026-05', type: 'expense', amount: 999 }, // stale month — ignored
];

describe('manual entries — current month only, never mixed with the closed month', () => {
  it('sums only the plan-month entries', () => {
    const sums = sumManualEntries(entries, '2026-06');
    expect(sums.expenses).toBe(42.5);
    expect(sums.income).toBe(1500);
    expect(sums.net).toBe(1457.5);
  });

  it('the closed-month analysis is untouched by manual movements', () => {
    const s = computeFinancialState(baselineInput({ manualEntries: entries }));
    expect(s.manualExpensesThisMonth).toBe(42.5);
    expect(s.manualIncomeThisMonth).toBe(1500);
    // May's baseline never absorbs June's salary (the €1.629 bug the prototype fixed)
    expect(s.net).toBe(760);
    expect(s.unallocated).toBe(760);
    expect(s.freeToSpend).toBe(760);
    expect(s.score.total).toBe(57);
    expect(s.leakTotal).toBe(219);
  });

  it('monthKey formats as YYYY-MM', () => {
    expect(monthKey(new Date(2026, 5, 15))).toBe('2026-06');
    expect(monthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });
});
