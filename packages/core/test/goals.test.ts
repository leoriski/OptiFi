import { describe, it, expect } from 'vitest';
import { computeFinancialState, monthsBetween, projectGoal } from '../src/index.js';
import { baselineInput, PROTOTYPE_TODAY } from './fixtures/baseline.js';

function withAllocation(goalId: string, alloc: number) {
  const input = baselineInput();
  input.goals.find((g) => g.id === goalId)!.monthlyAllocation = alloc;
  return input;
}

describe('goal allocation and the reserved-money model', () => {
  it('allocating €200 to the Japan trip: 4 months, misses the Aug 2026 deadline by 1', () => {
    const s = computeFinancialState(withAllocation('g2', 200));
    const p = s.goalProjections['g2']!;
    expect(p.state).toBe('allocated');
    expect(p.remaining).toBe(640);
    expect(p.months).toBe(4); // ceil(640/200)
    expect(p.estDate).toEqual(new Date(2026, 8, 1)); // Sep 2026
    expect(p.deadline).toEqual(new Date(2026, 7, 1)); // Aug 2026
    expect(p.onTrack).toBe(false);
    expect(p.monthsLate).toBe(1);
  });

  it('reserving money lowers freeToSpend and the safe pace', () => {
    const s = computeFinancialState(withAllocation('g1', 300));
    expect(s.allocatedTotal).toBe(300);
    expect(s.unallocated).toBe(460);
    expect(s.freeToSpend).toBe(460);
    expect(s.safePace.reservedForGoals).toBe(300);
    expect(s.safePace.weeklyPace).toBeCloseTo((2100 - 568.73 - 420 - 300) / 4.3, 2);
  });

  it('over-allocation flags but freeToSpend never goes negative', () => {
    const s = computeFinancialState(withAllocation('g1', 800));
    expect(s.unallocated).toBe(-40);
    expect(s.overAllocated).toBe(true);
    expect(s.overReserved).toBe(40);
    expect(s.monthDeficit).toBe(0); // net positivo → não há défice
    expect(s.freeToSpend).toBe(0);
  });

  it('mês NEGATIVO sem metas é DÉFICE, não "reservaste demais"', () => {
    const input = baselineInput();
    input.income = 1000;
    input.expenses = 1500;
    input.goals.forEach((g) => (g.monthlyAllocation = 0)); // nada reservado
    const s = computeFinancialState(input);
    expect(s.overAllocated).toBe(false); // não reservaste nada
    expect(s.overReserved).toBe(0);
    expect(s.monthDeficit).toBe(500); // gastaste 500 a mais do que recebeste
  });

  it('withdrawn money returns to the spendable pool', () => {
    const input = withAllocation('g1', 300);
    input.withdrawnThisMonth = 100;
    const s = computeFinancialState(input);
    expect(s.freeToSpend).toBe(560);
  });

  it('a reached goal projects as done regardless of allocation', () => {
    const p = projectGoal(
      { id: 'x', targetEur: 1000, currentEur: 1000, monthlyAllocation: 50 },
      PROTOTYPE_TODAY,
    );
    expect(p.state).toBe('done');
    expect(p.remaining).toBe(0);
  });

  it('no deadline means an allocated goal is always on track', () => {
    const p = projectGoal(
      { id: 'x', targetEur: 1000, currentEur: 0, monthlyAllocation: 100 },
      PROTOTYPE_TODAY,
    );
    expect(p.onTrack).toBe(true);
    expect(p.deadline).toBeNull();
  });

  it('the intentional-savings bonus is capped and never breaks the pillar ceiling', () => {
    // Baseline cashflow pillar is already 34 (ceiling): allocating must not exceed it.
    const s = computeFinancialState(withAllocation('g1', 600));
    expect(s.score.breakdown[0]!.value).toBe(34);
    // Weaker cashflow: income 2000, expenses 1700 → rate 15% → base 18; alloc 200 → +2.
    const weak = computeFinancialState(
      baselineInput({ income: 2000, expenses: 1700, goals: [{ id: 'g', targetEur: 5000, currentEur: 0, monthlyAllocation: 200 }] }),
    );
    expect(weak.score.breakdown[0]!.value).toBe(20);
  });

  it('monthsBetween is a calendar difference', () => {
    expect(monthsBetween(new Date(2026, 7, 1), new Date(2026, 8, 1))).toBe(1);
    expect(monthsBetween(new Date(2026, 0, 1), new Date(2027, 0, 1))).toBe(12);
  });
});
