// The prototype's demo dataset, verbatim (OPTIFI2.0/index.html). This is the
// executable specification: with these inputs the engine must reproduce the
// prototype's baseline numbers — score 57, net €760, weekly pace €258.43.

import type { FinancialInput, Goal, PlanItem, Subscription } from '../../src/index.js';

export const PROTOTYPE_SUBS: Subscription[] = [
  { id: 's1', name: 'Netflix', price: 12.99, daysSinceUse: 1, suspect: false, userStatus: 'unknown' },
  { id: 's2', name: 'Spotify Premium', price: 9.99, daysSinceUse: 0, suspect: false, userStatus: 'unknown' },
  { id: 's3', name: 'Amazon Prime', price: 8.99, daysSinceUse: 3, suspect: false, userStatus: 'unknown' },
  { id: 's4', name: 'HBO Max', price: 8.99, daysSinceUse: 47, suspect: true, userStatus: 'unknown' },
  { id: 's5', name: 'Adobe Creative Cloud', price: 24.99, daysSinceUse: 12, suspect: false, userStatus: 'unknown' },
  { id: 's6', name: 'NordVPN', price: 5.39, daysSinceUse: 92, suspect: true, userStatus: 'unknown' },
  { id: 's7', name: 'Notion Pro', price: 8.0, daysSinceUse: 5, suspect: false, userStatus: 'unknown' },
  { id: 's8', name: 'Duolingo Plus', price: 6.99, daysSinceUse: 21, suspect: true, userStatus: 'unknown' },
];

export const PROTOTYPE_PLAN_ITEMS: PlanItem[] = [
  { id: 'plan_restaurants', monthlySaving: 90 },
  { id: 'plan_hbo', monthlySaving: 8.99 },
  { id: 'plan_coffee', monthlySaving: 35 },
  { id: 'plan_nordvpn', monthlySaving: 5.39 },
  { id: 'plan_card', monthlySaving: 6.64 },
];

export const PROTOTYPE_GOALS: Goal[] = [
  { id: 'g1', targetEur: 20000, currentEur: 8400, targetMonth: 12, targetYear: 2026, monthlyAllocation: 0 },
  { id: 'g2', targetEur: 2000, currentEur: 1360, targetMonth: 8, targetYear: 2026, monthlyAllocation: 0 },
  { id: 'g3', targetEur: 5000, currentEur: 1850, targetMonth: 12, targetYear: 2026, monthlyAllocation: 0 },
];

// ccSpending — per-category spend of the analyzed month (calibrates limits).
export const PROTOTYPE_CATEGORY_SPEND = [
  { categoryId: 'Restaurants', amount: 180 },
  { categoryId: 'Groceries', amount: 122 },
  { categoryId: 'Utilities', amount: 82 },
  { categoryId: 'Transport', amount: 83 },
  { categoryId: 'Subscriptions', amount: 76 },
  { categoryId: 'Other', amount: 93 },
];

// Demo clock: _demoNow = 2026-06-01 (plan month June), _gaRefNow = 2026-05-01
// (goal-projection reference).
export const PROTOTYPE_TODAY = new Date(2026, 4, 1);
export const PROTOTYPE_PLAN_MONTH = '2026-06';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function baselineInput(overrides: Partial<FinancialInput> = {}): FinancialInput {
  return {
    imported: true,
    income: 2100, // OPTI_INCOME
    expenses: 1340, // OPTI_EXPENSES
    housingFixed: 482.4, // OPTI_HOUSING_FIXED — rent 450 + utilities 32.40
    baseLeak: 219, // _baseLeakAmt
    subs: clone(PROTOTYPE_SUBS),
    planItems: clone(PROTOTYPE_PLAN_ITEMS),
    planState: {},
    goals: clone(PROTOTYPE_GOALS),
    categoryLimits: {},
    categorySpend: clone(PROTOTYPE_CATEGORY_SPEND),
    manualEntries: [],
    withdrawnThisMonth: 0,
    planMonth: PROTOTYPE_PLAN_MONTH,
    today: PROTOTYPE_TODAY,
    ...overrides,
  };
}
