'use client';

// MODO DEMONSTRAÇÃO — perfil fictício "Ana, 26, Porto" para provar o valor da
// app ANTES de pedir o extrato real. Corre 100% no cliente, pelo MESMO motor
// determinístico (nada é inventado nos números), e NÃO escreve nada na base de
// dados — o que também é a prova viva da promessa de privacidade.

import {
  computeFinancialState,
  generateAnalysis,
  generateSmartInsights,
  type Analysis,
  type CategoryKey,
  type CategorySpend,
  type FinancialState,
  type Goal,
  type Insight,
  type PlanState,
  type Subscription,
  type SubscriptionStatus,
  type TxLite,
} from '@optifi/core';
import type { GoalRow, ImportRow, SubRow, TxRow } from './useFinance';

export const DEMO_COOKIE = 'optifi_demo';
export const DEMO_PROFILE_NAME = 'Ana';
const DEMO_INCOME = 1400;
const DEMO_MONTH = '2026-06'; // mês analisado (fechado)

// ── Cookie (partilhado com o middleware, que precisa de o ler no servidor) ──
export function isDemoActive(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c === `${DEMO_COOKIE}=1`);
}
export function enterDemo(): void {
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
}
export function exitDemo(): void {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

// ── Dados da Ana (Junho 2026) ──
type T = { d: string; desc: string; amount: number; cat: CategoryKey; type?: 'income' | 'expense' };
const M = (d: number) => `${DEMO_MONTH}-${String(d).padStart(2, '0')}`;

const DEMO_TX: T[] = [
  // Habitação (fixos)
  { d: M(2), desc: 'Renda Casa Porto', amount: 480, cat: 'habitacao' },
  { d: M(4), desc: 'EDP Comercial', amount: 52.3, cat: 'habitacao' },
  { d: M(6), desc: 'Águas do Porto', amount: 16.4, cat: 'habitacao' },
  { d: M(8), desc: 'NOS Comunicações', amount: 34.99, cat: 'habitacao' },
  // Alimentação (supermercado — essencial)
  { d: M(3), desc: 'Pingo Doce', amount: 41.2, cat: 'alimentacao' },
  { d: M(9), desc: 'Continente', amount: 53.7, cat: 'alimentacao' },
  { d: M(15), desc: 'Lidl', amount: 38.15, cat: 'alimentacao' },
  { d: M(22), desc: 'Pingo Doce', amount: 26.8, cat: 'alimentacao' },
  { d: M(27), desc: 'Mercadona', amount: 18.4, cat: 'alimentacao' },
  // Lazer (comer fora + compras — fonte de fuga)
  { d: M(5), desc: 'McDonalds Matosinhos', amount: 9.5, cat: 'lazer' },
  { d: M(6), desc: 'Starbucks NorteShopping', amount: 5.2, cat: 'lazer' },
  { d: M(7), desc: 'Uber Eats', amount: 18.5, cat: 'lazer' },
  { d: M(12), desc: 'Restaurante O Manel', amount: 24.0, cat: 'lazer' },
  { d: M(13), desc: 'Cafe Central', amount: 3.8, cat: 'lazer' },
  { d: M(18), desc: 'H3 Burger', amount: 11.2, cat: 'lazer' },
  { d: M(20), desc: 'Zara Porto', amount: 39.99, cat: 'lazer' },
  { d: M(24), desc: 'Telepizza', amount: 15.9, cat: 'lazer' },
  { d: M(28), desc: 'Bar do Porto', amount: 12.0, cat: 'lazer' },
  // Transporte (boleias repetidas → fuga por frequência)
  { d: M(3), desc: 'Uber *Trip', amount: 6.2, cat: 'transporte' },
  { d: M(8), desc: 'Uber *Trip', amount: 5.8, cat: 'transporte' },
  { d: M(11), desc: 'Uber *Trip', amount: 7.1, cat: 'transporte' },
  { d: M(16), desc: 'Bolt', amount: 4.9, cat: 'transporte' },
  { d: M(21), desc: 'Uber *Trip', amount: 8.3, cat: 'transporte' },
  { d: M(26), desc: 'Bolt', amount: 5.5, cat: 'transporte' },
  { d: M(1), desc: 'Metro do Porto Andante', amount: 40, cat: 'transporte' },
  // Subscrições (também aparecem como movimento; a lista de subs vem à parte)
  { d: M(2), desc: 'Netflix.com', amount: 12.99, cat: 'subscricoes' },
  { d: M(2), desc: 'Spotify', amount: 6.99, cat: 'subscricoes' },
  { d: M(4), desc: 'HBO Max', amount: 8.99, cat: 'subscricoes' },
  { d: M(4), desc: 'Disney Plus', amount: 5.99, cat: 'subscricoes' },
  { d: M(10), desc: 'Fitness Hut', amount: 39.99, cat: 'subscricoes' },
  // Saúde
  { d: M(14), desc: 'Farmácia Sá da Bandeira', amount: 21.6, cat: 'saude' },
  // Outros (acima do teto → fuga)
  { d: M(9), desc: 'Amazon', amount: 34.2, cat: 'outros' },
  { d: M(17), desc: 'Worten', amount: 45.0, cat: 'outros' },
  { d: M(23), desc: 'Fnac', amount: 37.9, cat: 'outros' },
  { d: M(29), desc: 'Compra online', amount: 22.5, cat: 'outros' },
  // Transferência para pessoa (NÃO é fuga — dinheiro que sai mas não é consumo)
  { d: M(19), desc: 'MB WAY P/ Rita', amount: 30, cat: 'transferencias' },
];

const DEMO_SUBS_RAW: { id: string; name: string; price: number }[] = [
  { id: 'demo-netflix', name: 'Netflix', price: 12.99 },
  { id: 'demo-hbo', name: 'HBO Max', price: 8.99 },
  { id: 'demo-disney', name: 'Disney+', price: 5.99 },
  { id: 'demo-spotify', name: 'Spotify', price: 6.99 },
  { id: 'demo-gym', name: 'Fitness Hut', price: 39.99 },
];

const DEMO_GOAL: GoalRow = {
  id: 'demo-goal-1',
  name: 'Fundo de emergência',
  icon_key: 'shield',
  target_eur: 3000,
  current_eur: 240,
  target_month: 12,
  target_year: 2027,
  monthly_allocation: 90,
  allocation_day: 1,
};

/** Overrides interativos da sessão (ex.: subscrições canceladas, plano feito). */
export interface DemoOverrides {
  subStatus: Record<string, SubscriptionStatus>;
  planState: PlanState;
}
export const emptyDemoOverrides = (): DemoOverrides => ({ subStatus: {}, planState: {} });

export interface DemoFinance {
  imp: ImportRow;
  history: ImportRow[];
  txs: TxRow[];
  subs: SubRow[];
  goals: GoalRow[];
  categorySpend: CategorySpend[];
  analysis: Analysis;
  smart: Insight[];
  fs: FinancialState;
  planState: PlanState;
}

/** Constrói o estado financeiro completo da demo — espelha o reload() real. */
export function buildDemoFinance(planMonth: string, ov: DemoOverrides): DemoFinance {
  const expenses = round2(DEMO_TX.filter((t) => (t.type ?? 'expense') === 'expense').reduce((a, b) => a + b.amount, 0));
  const housingFixed = round2(DEMO_TX.filter((t) => t.cat === 'habitacao').reduce((a, b) => a + b.amount, 0));

  const imp: ImportRow = {
    id: 'demo-import',
    bank: 'DEMO',
    statement_month: DEMO_MONTH,
    income: DEMO_INCOME,
    expenses,
    housing_fixed: housingFixed,
  };

  const txs: TxRow[] = DEMO_TX.map((t) => ({
    tx_date: t.d,
    description: t.desc,
    category: t.cat,
    amount: t.amount,
    tx_type: t.type ?? 'expense',
  }));

  // Gasto por categoria (com contagem, para a fuga por frequência)
  const byCat = new Map<string, { amount: number; count: number }>();
  for (const t of txs) {
    if (t.tx_type !== 'expense') continue;
    const cur = byCat.get(t.category) ?? { amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    byCat.set(t.category, cur);
  }
  const categorySpend: CategorySpend[] = [...byCat.entries()].map(([categoryId, v]) => ({
    categoryId,
    amount: round2(v.amount),
    count: v.count,
  }));

  const subs: SubRow[] = DEMO_SUBS_RAW.map((s) => ({
    id: s.id,
    name: s.name,
    price: s.price,
    user_status: ov.subStatus[s.id] ?? 'unknown',
    import_id: imp.id,
  }));
  const coreSubs: Subscription[] = subs.map((s) => ({ id: s.id, name: s.name, price: s.price, userStatus: s.user_status }));

  const analysis = generateAnalysis({ income: DEMO_INCOME, expenses, categorySpend, subs: coreSubs });

  const goals: GoalRow[] = [DEMO_GOAL];
  const coreGoals: Goal[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetEur: g.target_eur,
    currentEur: g.current_eur,
    monthlyAllocation: g.monthly_allocation,
    allocationDay: g.allocation_day,
    targetMonth: g.target_month ?? undefined,
    targetYear: g.target_year ?? undefined,
  }));

  const now = new Date();
  const fs = computeFinancialState({
    imported: true,
    income: DEMO_INCOME,
    expenses,
    housingFixed,
    baseLeak: analysis.baseLeak,
    subs: coreSubs,
    planItems: analysis.planItems,
    planState: ov.planState,
    goals: coreGoals,
    categoryLimits: {},
    categorySpend,
    manualEntries: [],
    mealCardMonthly: 0,
    allocatedGoalIds: [],
    withdrawnThisMonth: 0,
    planMonth,
    today: now,
    balance: null,
  });

  const txLite: TxLite[] = txs.map((t) => ({ date: t.tx_date, description: t.description, amount: t.amount, type: t.tx_type, category: t.category }));
  const smart = generateSmartInsights({
    income: DEMO_INCOME,
    expenses,
    categorySpend,
    subs: coreSubs,
    transactions: txLite,
    goals: coreGoals,
    goalProjections: fs.goalProjections,
    analysis,
    today: now,
  });

  return { imp, history: [imp], txs: txs.slice().sort((a, b) => (a.tx_date < b.tx_date ? 1 : -1)), subs, goals, categorySpend, analysis, smart, fs, planState: ov.planState };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
