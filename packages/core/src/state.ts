// FONTE ÚNICA DE VERDADE — the prototype's recalcAll() as a pure function.
// Input: the persisted sources. Output: every derived number, computed in one
// pass so no view can ever disagree with another.

import type {
  CategoryLimits,
  CategoryLimitState,
  CategorySpend,
  Goal,
  GoalProjection,
  ManualEntry,
  PlanItem,
  PlanState,
  Subscription,
} from './types.js';
import { currentLeak } from './leak.js';
import { activeSubsTotal } from './subscriptions.js';
import { computeOptiScore, type OptiScore } from './score.js';
import { computeSafePace, type SafePace } from './pace.js';
import { projectGoal } from './goals.js';
import { computeLimits } from './limits.js';
import { sumManualEntries, sumMealCardSpent } from './manual.js';

export interface FinancialInput {
  /** True only after a successful statement import. */
  imported: boolean;
  /** Income of the analyzed (closed) month, in EUR. */
  income: number;
  /** Expenses of the analyzed (closed) month, in EUR. */
  expenses: number;
  /** Fixed housing commitment from the statement (rent + utilities). */
  housingFixed: number;
  /** Total waste identified in the analyzed month before any plan action. */
  baseLeak: number;
  subs: Subscription[];
  planItems: PlanItem[];
  planState: PlanState;
  goals: Goal[];
  categoryLimits: CategoryLimits;
  /** Per-category spend of the analyzed month (calibrates limits). */
  categorySpend: CategorySpend[];
  manualEntries: ManualEntry[];
  /** Quanto o utilizador recebe por mês no cartão refeição (0/ausente = sem cartão). */
  mealCardMonthly?: number;
  /** IDs das metas cuja alocação mensal JÁ foi feita neste mês (já saiu da conta). */
  allocatedGoalIds?: string[];
  /** Money withdrawn from goals this month — returns to the spendable pool. */
  withdrawnThisMonth: number;
  /** Current plan month as an ISO key ('YYYY-MM'). */
  planMonth: string;
  /** Reference "now" for goal projections. */
  today: Date;
  /**
   * Saldo real ligado a tudo: `anchor` é o saldo que o utilizador definiu
   * (ou aceitou do extrato) e `adjustedNet` é a soma assinada dos movimentos
   * manuais registados DEPOIS dessa âncora. null = ainda não definido.
   */
  balance?: { anchor: number; adjustedNet: number } | null;
}

export interface FinancialState {
  imported: boolean;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  subsTotal: number;
  leakTotal: number;
  allocatedTotal: number;
  unallocated: number;
  overAllocated: boolean;
  /** What's left of the baseline net after reserving for goals, plus withdrawals. */
  freeToSpend: number;
  goalProjections: Record<string, GoalProjection>;
  /** Estado da alocação mensal de cada meta neste mês. */
  goalAllocationStatus: Record<string, 'done' | 'due' | 'scheduled' | 'none'>;
  categoryLimitStates: Record<string, CategoryLimitState>;
  limitsSavingsPotential: number;
  /** Gasto do MÊS CORRENTE por categoria (registos manuais) — alimenta os limites. */
  manualCategorySpend: CategorySpend[];
  /** Pote do cartão refeição do mês corrente (null se não usa cartão). */
  mealCard: { monthly: number; spent: number; left: number } | null;
  limitsCount: number;
  manualExpensesThisMonth: number;
  manualIncomeThisMonth: number;
  manualNet: number;
  /** Saldo atual estimado (âncora + registos posteriores); null se não definido. */
  currentBalance: number | null;
  /** O que desse saldo está livre depois do reservado para metas; null se não definido. */
  spendableNow: number | null;
  safePace: SafePace;
  score: OptiScore;
}

export function computeFinancialState(input: FinancialInput): FinancialState {
  // 1. Active subscriptions (exclude cancelled)
  const subsTotal = activeSubsTotal(input.subs);

  // 2. Active money leak (done/ignored plan items are resolved)
  const leakTotal = currentLeak(input.baseLeak, input.planItems, input.planState);

  // 3. Cashflow of the closed month
  const net = input.income - input.expenses;
  const savingsRate = input.income > 0 ? net / input.income : 0;

  // 3a. Manual entries for the CURRENT month. They reflect the present only —
  //     never mixed into the closed-month analysis (net/expenses above stay
  //     the imported baseline).
  const manual = sumManualEntries(input.manualEntries, input.planMonth);

  // 3a-bis. Pote do cartão refeição: recebes X por mês, gastas Y com o cartão,
  //         restam Z para as refeições essenciais. Dinheiro à parte da conta.
  const mealMonthly = input.mealCardMonthly && input.mealCardMonthly > 0 ? input.mealCardMonthly : 0;
  const mealSpent = sumMealCardSpent(input.manualEntries, input.planMonth);
  const mealCard =
    mealMonthly > 0 || mealSpent > 0
      ? { monthly: mealMonthly, spent: mealSpent, left: Math.round((mealMonthly - mealSpent) * 100) / 100 }
      : null;

  // 3b. Alocação para metas — com estado por meta neste mês:
  //   - 'done': o utilizador JÁ transferiu este mês → o dinheiro já saiu da
  //     conta (o saldo que ele indicou já o exclui) → NÃO se desconta de novo;
  //   - 'due': ainda por alocar e já passou o dia definido → está na conta mas
  //     comprometido → desconta-se do gastável e a app lembra o utilizador;
  //   - 'scheduled': por alocar mas o dia ainda não chegou → dinheiro livre.
  // allocatedTotal = só o que está PENDENTE e vencido (o que ainda tens de pôr
  // de lado). O já alocado conta no progresso da meta, não no reservado.
  const todayDay = input.today.getDate();
  const doneIds = new Set(input.allocatedGoalIds ?? []);
  let allocatedTotal = 0;
  const goalProjections: Record<string, GoalProjection> = {};
  const goalAllocationStatus: Record<string, 'done' | 'due' | 'scheduled' | 'none'> = {};
  for (const g of input.goals) {
    const monthly = g.monthlyAllocation || 0;
    const day = g.allocationDay && g.allocationDay >= 1 ? g.allocationDay : 1;
    let status: 'done' | 'due' | 'scheduled' | 'none';
    if (monthly <= 0) status = 'none';
    else if (doneIds.has(g.id)) status = 'done';
    else if (todayDay >= day) status = 'due';
    else status = 'scheduled';
    if (status === 'due') allocatedTotal += monthly;
    goalAllocationStatus[g.id] = status;
    goalProjections[g.id] = projectGoal(g, input.today);
  }
  // What's left to allocate comes ONLY from the closed-month net. Manual
  // current-month movements are NOT folded in — each month keeps its own
  // liquid (May's net is never summed with June's manual salary).
  const unallocated = net - allocatedTotal;
  const overAllocated = unallocated < 0;

  // 3c. Free to spend = baseline net after reserving for goals, plus anything
  //     withdrawn back. Reserved money is conceptual (stays in the user's
  //     account) but is removed from the healthy spendable amount.
  const freeToSpend = Math.max(0, net - allocatedTotal) + (input.withdrawnThisMonth || 0);

  // 3d. Limites por categoria = orçamento do MÊS CORRENTE: o utilizador define
  //     no início do mês quanto quer gastar e a app mede o que ele REGISTA
  //     este mês (nunca o mês analisado — esse é só a referência).
  const manualCatMap = new Map<string, number>();
  for (const e of input.manualEntries) {
    if (!e || e.month !== input.planMonth || e.type !== 'expense' || e.viaMealCard) continue;
    const cat = e.category ?? 'outros';
    manualCatMap.set(cat, (manualCatMap.get(cat) ?? 0) + e.amount);
  }
  // Todas as categorias com limite entram (gasto 0 se ainda nada registado) —
  // um limite sem registos está "Dentro", não desaparece.
  for (const categoryId of Object.keys(input.categoryLimits)) {
    if (!manualCatMap.has(categoryId)) manualCatMap.set(categoryId, 0);
  }
  const currentCatSpend = [...manualCatMap.entries()].map(([categoryId, amount]) => ({
    categoryId,
    amount: Math.round(amount * 100) / 100,
  }));
  const limits = computeLimits(input.categoryLimits, currentCatSpend);
  // "Se cumprires os limites libertas €X/mês" — potencial calculado contra o
  //  mês ANALISADO (o que gastaste), não contra o progresso corrente.
  const limitsPotential = computeLimits(input.categoryLimits, input.categorySpend).savingsPotential;

  // 3e. Saldo real: âncora definida pelo utilizador + movimentos registados
  //     depois dela. É A ponte entre o mês fechado analisado e o presente —
  //     tudo o que mexe no dinheiro de agora passa por aqui.
  const currentBalance =
    input.balance != null ? Math.round((input.balance.anchor + input.balance.adjustedNet) * 100) / 100 : null;
  // Assinado, NÃO limitado a 0: se reservaste mais do que tens, o gastável é
  // negativo e a UI mostra-o em vermelho — a verdade vem sempre com sinal.
  const spendableNow = currentBalance === null ? null : Math.round((currentBalance - allocatedTotal) * 100) / 100;

  // 4. Safe pace
  const safePace = computeSafePace({
    income: input.income,
    expenses: input.expenses,
    activeSubsTotal: subsTotal,
    housingFixed: input.housingFixed,
    reservedForGoals: allocatedTotal,
  });

  // 5. OptiFi Score
  const score = computeOptiScore({
    income: input.income,
    expenses: input.expenses,
    subs: input.subs,
    leakTotal,
    allocatedTotal,
    limitsSavingsPotential: limitsPotential,
  });

  return {
    imported: input.imported,
    income: input.income,
    expenses: input.expenses,
    net,
    savingsRate,
    subsTotal,
    leakTotal,
    allocatedTotal,
    unallocated,
    overAllocated,
    freeToSpend,
    goalProjections,
    goalAllocationStatus,
    categoryLimitStates: limits.states,
    limitsSavingsPotential: limitsPotential,
    limitsCount: limits.count,
    manualCategorySpend: currentCatSpend,
    mealCard,
    manualExpensesThisMonth: manual.expenses,
    manualIncomeThisMonth: manual.income,
    manualNet: manual.net,
    currentBalance,
    spendableNow,
    safePace,
    score,
  };
}
