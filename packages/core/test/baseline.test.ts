// Parity suite — the engine must reproduce the prototype's baseline exactly.
import { describe, it, expect } from 'vitest';
import { computeFinancialState, scoreQuality } from '../src/index.js';
import { baselineInput } from './fixtures/baseline.js';

describe('prototype baseline parity (57 / €760 / €258.43)', () => {
  const s = computeFinancialState(baselineInput());

  it('net = €760 and savings rate ≈ 36.19%', () => {
    expect(s.net).toBe(760);
    expect(s.savingsRate).toBeCloseTo(760 / 2100, 10);
  });

  it('subscriptions total €86.33 with all 8 active', () => {
    expect(s.subsTotal).toBeCloseTo(86.33, 2);
  });

  it('money leak = €219 with no plan action', () => {
    expect(s.leakTotal).toBe(219);
  });

  it('OptiFi Score = 57 with breakdown 34/18/5', () => {
    expect(s.score.total).toBe(57);
    expect(s.score.breakdown.map((b) => b.value)).toEqual([34, 18, 5]);
    expect(s.score.breakdown.map((b) => b.max)).toEqual([34, 33, 33]);
    expect(scoreQuality(s.score.total)).toBe('fair');
  });

  it('safe pace: weekly ≈ €258.43, daily ≈ €37.04, status good', () => {
    expect(s.safePace.fixedCommitted).toBeCloseTo(86.33 + 482.4, 2);
    expect(s.safePace.savingsTarget).toBeCloseTo(420, 10);
    expect(s.safePace.weeklyPace).toBeCloseTo(258.43, 1);
    expect(s.safePace.dailyPace).toBeCloseTo(37.04, 1);
    // variable spent 771.27 ≤ budget 1111.27
    expect(s.safePace.status).toBe('good');
  });

  it('no allocations: unallocated = net, freeToSpend = net', () => {
    expect(s.allocatedTotal).toBe(0);
    expect(s.unallocated).toBe(760);
    expect(s.overAllocated).toBe(false);
    expect(s.freeToSpend).toBe(760);
  });

  it('no manual entries or limits at baseline', () => {
    expect(s.manualNet).toBe(0);
    expect(s.limitsCount).toBe(0);
    expect(s.limitsSavingsPotential).toBe(0);
  });

  it('all goals project as unallocated (none funded, none done)', () => {
    expect(Object.values(s.goalProjections).map((p) => p.state)).toEqual([
      'unallocated',
      'unallocated',
      'unallocated',
    ]);
  });
});
