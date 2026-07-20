import type { Subscription } from './types.js';
import { activeSubsTotal, countByStatus } from './subscriptions.js';

export interface ScoreInput {
  income: number;
  expenses: number;
  subs: Subscription[];
  /** Active money leak (see currentLeak). */
  leakTotal: number;
  /** Total the user reserved for goals this month (intentional-savings bonus). */
  allocatedTotal: number;
  /** Money freed if the user meets the category limits they set (discipline bonus). */
  limitsSavingsPotential: number;
}

export type ScorePillarKey = 'cashflow' | 'subscriptions' | 'leaks';

export interface ScorePillar {
  key: ScorePillarKey;
  value: number;
  max: number;
}

export interface OptiScore {
  total: number;
  breakdown: ScorePillar[];
  income: number;
  expenses: number;
  subsTotal: number;
  subsUnknown: number;
  subsRejected: number;
  leakTotal: number;
  savingsRate: number;
}

export type ScoreQuality = 'excellent' | 'good' | 'fair' | 'risk';

/**
 * OptiFi Score — three pillars: cashflow (0–34), subscriptions (0–33),
 * leaks (0–33). Ported verbatim from the prototype's computeOptiScore.
 * Prototype baseline (income 2100, expenses 1340, 8 unreviewed subs,
 * leak 219) must always yield 57.
 */
export function computeOptiScore(input: ScoreInput): OptiScore {
  const { income, expenses, subs, leakTotal } = input;
  const subsTotal = activeSubsTotal(subs);
  const subsUnknown = countByStatus(subs, 'unknown');
  const subsRejected = countByStatus(subs, 'rejected');

  const savingsRate = income > 0 ? (income - expenses) / income : 0;
  const subsRatio = income > 0 ? subsTotal / income : 0;
  const leakRatio = income > 0 ? leakTotal / income : 0;

  // 1. CASHFLOW (0-34)
  let score1: number;
  if (income <= 0) {
    score1 = 17;
  } else {
    score1 = savingsRate >= 0.3 ? 34 : savingsRate >= 0.2 ? 27 : savingsRate >= 0.1 ? 18 : savingsRate >= 0 ? 10 : 0;
    // Intentional-savings bonus: committing money to goals is healthier than the
    // same cashflow with no plan. Proportional, small and capped so it never
    // breaks the pillar ceiling (34).
    const allocatedTotal = input.allocatedTotal > 0 ? input.allocatedTotal : 0;
    if (allocatedTotal > 0) score1 += Math.min((allocatedTotal / income) * 20, 5);
    score1 = Math.max(0, Math.min(34, score1));
  }

  // 2. SUBSCRIPTIONS (0-33)
  let score2: number;
  if (income <= 0) {
    score2 = 16;
  } else {
    // Subscrições "não vale" já NÃO penalizam aqui — passaram a contar no
    // money leak (pilar das fugas), para não haver duplo-cálculo.
    score2 = subsRatio <= 0.03 ? 25 : subsRatio <= 0.06 ? 18 : subsRatio <= 0.1 ? 11 : 4;
    if (subsUnknown === 0) score2 += 8;
    score2 = Math.max(0, Math.min(33, score2));
  }

  // 3. LEAKS (0-33)
  let score3: number;
  if (income <= 0) {
    score3 = 16;
  } else {
    score3 = leakRatio <= 0.02 ? 33 : leakRatio <= 0.05 ? 24 : leakRatio <= 0.1 ? 13 : 5;
    // Category limits are a disciplined commitment to cut waste. Small bonus
    // proportional to the committed savings, capped below the pillar ceiling.
    // This is a discipline signal, NOT the leak counted twice — baseline
    // (no limits) leaves score3 unchanged.
    const limPot = input.limitsSavingsPotential > 0 ? input.limitsSavingsPotential : 0;
    if (limPot > 0) score3 += Math.min((limPot / income) * 20, 6);
    score3 = Math.max(0, Math.min(33, score3));
  }

  let total = Math.round(score1 + score2 + score3);
  total = Math.max(0, Math.min(100, total));

  const breakdown: ScorePillar[] = [
    { key: 'cashflow', value: Math.round(score1), max: 34 },
    { key: 'subscriptions', value: Math.round(score2), max: 33 },
    { key: 'leaks', value: Math.round(score3), max: 33 },
  ];

  return {
    total,
    breakdown,
    income,
    expenses,
    subsTotal,
    subsUnknown,
    subsRejected,
    leakTotal,
    savingsRate,
  };
}

export function scoreQuality(total: number): ScoreQuality {
  if (total >= 80) return 'excellent';
  if (total >= 65) return 'good';
  if (total >= 45) return 'fair';
  return 'risk';
}
