import {
  computeFinancialState,
  generateAnalysis,
  generateSmartInsights,
  monthKey,
  type CategoryLimits,
  type CategorySpend,
  type Goal,
  type ManualEntry,
  type PlanItemStatus,
  type PlanState,
  type Subscription,
  type TxLite,
} from '@optifi/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeBalanceAnchor, splitOpening } from './balance.js';
import type { FinanceSnapshot, GoalRow, ImportRow, ManualRow, SubRow, TxRow } from './types.js';

/**
 * Lê tudo o que o utilizador tem na base de dados e devolve o estado financeiro
 * já calculado. É o único caminho de LEITURA de dados financeiros: a web e a
 * app nativa chamam esta função, por isso não há forma de as duas responderem
 * coisas diferentes à mesma pergunta.
 *
 * As escritas vivem no `financeWrites` (write.ts), pelo mesmo motivo.
 */
export async function loadFinanceSnapshot(
  supabase: SupabaseClient,
  opts: { today?: Date } = {},
): Promise<FinanceSnapshot> {
  const today = opts.today ?? new Date();
  const planMonth = monthKey(today);

  const { data: imports } = await supabase
    .from('imports')
    .select('id,bank,statement_month,income,expenses,housing_fixed')
    .eq('status', 'ready')
    .order('statement_month', { ascending: false })
    .limit(12);
  const latest = ((imports?.[0] as ImportRow | undefined) ?? null) as ImportRow | null;
  const history = [...((imports ?? []) as ImportRow[])].reverse();

  const [{ data: goalData }, { data: limitData }, { data: manualData }, { data: wdData }, { data: allocData }] =
    await Promise.all([
      supabase
        .from('goals')
        .select('id,name,icon_key,target_eur,current_eur,target_month,target_year,monthly_allocation,allocation_day')
        .order('created_at'),
      supabase.from('category_limits').select('category,limit_eur'),
      supabase
        .from('manual_entries')
        .select('id,month,entry_type,amount,category,note,meal_card,paid_at,created_at')
        .eq('month', planMonth)
        .order('created_at', { ascending: false }),
      supabase.from('goal_withdrawals').select('amount,created_at').eq('month', planMonth),
      supabase.from('goal_monthly_allocations').select('goal_id,amount,created_at').eq('month', planMonth),
    ]);

  // Perfil resiliente: `meal_card_eur` pode não existir ainda (migração 0006).
  let profData: { name?: string | null; meal_card_eur?: number | null } = {};
  const withMeal = await supabase.from('profiles').select('name,meal_card_eur').limit(1).maybeSingle();
  if (withMeal.error) {
    const nameOnly = await supabase.from('profiles').select('name').limit(1).maybeSingle();
    profData = (nameOnly.data ?? {}) as typeof profData;
  } else {
    profData = (withMeal.data ?? {}) as typeof profData;
  }
  const profileName = profData.name ?? '';
  const mealCard = profData.meal_card_eur != null ? Number(profData.meal_card_eur) : 0;

  const allocRows = (allocData ?? []) as { goal_id: string; amount: number; created_at?: string }[];
  const allocatedGoalIds = allocRows.map((a) => a.goal_id);
  const wdRows = (wdData ?? []) as { amount: number; created_at?: string }[];

  const { opening, flow } = splitOpening((manualData ?? []) as ManualRow[]);
  const balance = computeBalanceAnchor(opening, flow, allocRows, wdRows);

  const goalRows = (goalData ?? []) as GoalRow[];
  const limits: Record<string, number> = {};
  for (const l of limitData ?? []) limits[l.category] = Number(l.limit_eur);
  const withdrawn = wdRows.reduce((a, b) => a + Number(b.amount), 0);

  const base = {
    profileName,
    history,
    imp: latest,
    goals: goalRows,
    limits,
    // A lista exposta à UI exclui o movimento de abertura (mostrado à parte).
    manual: flow,
    planMonth,
    balanceSet: opening !== null,
    openingBalance: opening
      ? { id: opening.id, amount: Number(opening.amount), at: opening.created_at ?? '' }
      : null,
    mealCard,
    allocatedGoalIds,
  };

  if (!latest) {
    return { ...base, fs: null, analysis: null, smart: [], subs: [], txs: [], categorySpend: [], planState: {} };
  }

  const [{ data: txData }, { data: subData }, { data: planData }] = await Promise.all([
    supabase.from('transactions').select('tx_date,description,category,amount,tx_type').eq('import_id', latest.id),
    // Subscrições do último import + as adicionadas manualmente (import_id null)
    supabase
      .from('subscriptions')
      .select('id,name,price,user_status,import_id')
      .or(`import_id.eq.${latest.id},import_id.is.null`)
      .order('price', { ascending: false }),
    supabase.from('plan_items').select('item_key,state').eq('import_id', latest.id).not('item_key', 'is', null),
  ]);

  const byCat = new Map<string, { amount: number; count: number }>();
  for (const t of txData ?? []) {
    if (t.tx_type !== 'expense') continue;
    const cur = byCat.get(t.category) ?? { amount: 0, count: 0 };
    cur.amount += Number(t.amount);
    cur.count += 1;
    byCat.set(t.category, cur);
  }
  const categorySpend: CategorySpend[] = [...byCat.entries()].map(([categoryId, { amount, count }]) => ({
    categoryId,
    amount: Math.round(amount * 100) / 100,
    count,
  }));

  const subRows = (subData ?? []) as SubRow[];
  const coreSubs: Subscription[] = subRows.map((s) => ({
    id: s.id,
    name: s.name,
    price: Number(s.price),
    userStatus: s.user_status,
  }));

  const analysis = generateAnalysis({
    income: Number(latest.income),
    expenses: Number(latest.expenses),
    categorySpend,
    subs: coreSubs,
  });

  const planState: PlanState = {};
  for (const row of planData ?? []) {
    if (row.item_key) planState[row.item_key] = { state: row.state as PlanItemStatus };
  }

  const coreGoals: Goal[] = goalRows.map((g) => {
    const goal: Goal = {
      id: g.id,
      name: g.name,
      targetEur: Number(g.target_eur),
      currentEur: Number(g.current_eur),
      monthlyAllocation: Number(g.monthly_allocation),
      allocationDay: Number(g.allocation_day ?? 1),
    };
    if (g.target_month) goal.targetMonth = g.target_month;
    if (g.target_year) goal.targetYear = g.target_year;
    return goal;
  });

  const coreManual: ManualEntry[] = flow.map((m) => {
    const entry: ManualEntry = {
      id: m.id,
      month: m.month,
      type: m.entry_type,
      amount: Number(m.amount),
      category: m.category,
      viaMealCard: m.meal_card === true,
      paid: m.paid_at != null,
    };
    // A nota é o que identifica a despesa ("Netflix"). Sem ela o motor não
    // consegue ver que a subscrição já está registada e conta-a a dobrar.
    if (m.note) entry.note = m.note;
    return entry;
  });
  // O saldo definido pelo utilizador é dinheiro que ENTROU na conta (ex.: o
  // salário no início do mês) → conta como RECEITA do mês corrente. Fica só
  // aqui (no cálculo); a lista de movimentos mostra-o pelo marcador próprio.
  if (opening) {
    coreManual.push({
      id: opening.id,
      month: opening.month,
      type: 'income',
      amount: Number(opening.amount),
      category: 'receita',
    });
  }

  const fs = computeFinancialState({
    imported: true,
    income: Number(latest.income),
    expenses: Number(latest.expenses),
    housingFixed: Number(latest.housing_fixed),
    baseLeak: analysis.baseLeak,
    subs: coreSubs,
    planItems: analysis.planItems,
    planState,
    goals: coreGoals,
    categoryLimits: limits as CategoryLimits,
    categorySpend,
    manualEntries: coreManual,
    mealCardMonthly: mealCard,
    allocatedGoalIds,
    withdrawnThisMonth: withdrawn,
    planMonth,
    today,
    balance,
  });

  const txLite: TxLite[] = (txData ?? []).map((t) => ({
    date: t.tx_date as string,
    description: t.description as string,
    amount: Number(t.amount),
    type: t.tx_type as 'income' | 'expense',
    category: t.category as string,
  }));
  const smart = generateSmartInsights({
    income: Number(latest.income),
    expenses: Number(latest.expenses),
    categorySpend,
    subs: coreSubs,
    transactions: txLite,
    goals: coreGoals,
    goalProjections: fs.goalProjections,
    analysis,
    today,
  });

  const txs = ((txData ?? []) as TxRow[]).slice().sort((a, b) => (a.tx_date < b.tx_date ? 1 : -1));

  return { ...base, fs, analysis, smart, subs: subRows, txs, categorySpend, planState };
}
