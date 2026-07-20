'use client';

// O elo entre a base de dados e o motor: carrega o mês importado, gera a
// análise (função pura) e calcula o estado financeiro completo. Todas as
// vistas leem daqui — a fonte única de verdade. Fase 4: objetivos, limites
// por categoria e movimentos manuais entram no cálculo.

import { useCallback, useEffect, useState } from 'react';
import {
  computeFinancialState,
  generateAnalysis,
  generateSmartInsights,
  monthKey,
  type Analysis,
  type CategoryKey,
  type CategoryLimits,
  type CategorySpend,
  type FinancialState,
  type Goal,
  type Insight,
  type ManualEntry,
  type PlanItemStatus,
  type PlanState,
  type Subscription,
  type SubscriptionStatus,
  type TxLite,
} from '@optifi/core';
import { createClient } from './supabase/client';

export interface ImportRow {
  id: string;
  bank: string;
  statement_month: string;
  income: number;
  expenses: number;
  housing_fixed: number;
}

export interface SubRow {
  id: string;
  name: string;
  price: number;
  user_status: SubscriptionStatus;
  /** null = adicionada manualmente pelo utilizador. */
  import_id?: string | null;
}

export interface GoalRow {
  id: string;
  name: string;
  icon_key: string;
  target_eur: number;
  current_eur: number;
  target_month: number | null;
  target_year: number | null;
  monthly_allocation: number;
  allocation_day: number;
}

export interface ManualRow {
  id: string;
  month: string;
  entry_type: 'income' | 'expense';
  amount: number;
  category: CategoryKey;
  note: string | null;
  meal_card?: boolean;
}

export interface GoalDraft {
  id?: string;
  name: string;
  icon_key: string;
  target_eur: number;
  current_eur: number;
  target_month: number;
  target_year: number;
  monthly_allocation: number;
  allocation_day: number;
}

export interface TxRow {
  tx_date: string;
  description: string;
  category: CategoryKey;
  amount: number;
  tx_type: 'income' | 'expense';
}

export interface Finance {
  loading: boolean;
  imported: boolean;
  /** Nome do perfil (para a saudação). */
  profileName: string;
  /** Todos os meses importados, ascendente (para o gráfico de cashflow). */
  history: ImportRow[];
  imp: ImportRow | null;
  fs: FinancialState | null;
  analysis: Analysis | null;
  /** Insights inteligentes (motor determinístico — o "agente" sem IA). */
  smart: Insight[];
  subs: SubRow[];
  /** Movimentos do mês importado (data desc), para a lista da Atividade. */
  txs: TxRow[];
  goals: GoalRow[];
  limits: Record<string, number>;
  manual: ManualRow[];
  categorySpend: CategorySpend[];
  planState: PlanState;
  planMonth: string;
  /** True quando o utilizador já fixou um saldo (movimento de abertura existe). */
  balanceSet: boolean;
  /** O movimento de abertura atual (âncora do saldo), se existir. */
  openingBalance: OpeningBalance | null;
  /** Valor mensal do cartão/ticket refeição (0 = não definido). */
  mealCard: number;
  /** IDs das metas cuja alocação mensal já foi feita este mês. */
  allocatedGoalIds: string[];
  reload: () => Promise<void>;
  /** Define o valor mensal do cartão refeição. */
  setMealCardValue: (eur: number) => Promise<void>;
  /** Define/atualiza o saldo (cria um novo movimento de abertura). */
  setBalance: (eur: number) => Promise<void>;
  /** Remove o movimento de abertura (volta a "define o teu saldo"). */
  clearBalance: () => Promise<void>;
  setSubVerdict: (id: string, status: SubscriptionStatus) => Promise<void>;
  addSubscription: (name: string, price: number) => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  setPlanItemState: (itemKey: string, state: PlanItemStatus, title: string, saving: number) => Promise<void>;
  saveGoal: (draft: GoalDraft) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  setAllocation: (id: string, value: number) => Promise<void>;
  withdrawFromGoal: (id: string, amount: number) => Promise<void>;
  /** Marca a alocação mensal de uma meta como feita este mês (o dinheiro saiu). */
  markGoalAllocated: (id: string) => Promise<void>;
  /** Desfaz a marca de alocação deste mês. */
  unmarkGoalAllocated: (id: string) => Promise<void>;
  setLimit: (category: string, eur: number) => Promise<void>;
  clearLimit: (category: string) => Promise<void>;
  addManual: (entry: { type: 'income' | 'expense'; amount: number; category: CategoryKey; note: string; mealCard?: boolean }) => Promise<void>;
  removeManual: (id: string) => Promise<void>;
}

/**
 * O saldo definido pelo utilizador é guardado como um MOVIMENTO DE ABERTURA
 * real (manual_entries com esta nota-sentinela), não em localStorage nem numa
 * coluna à parte. Assim aparece nos movimentos e alimenta o cashflow — e
 * persiste na base de dados sem precisar de nova migração.
 */
export const OPENING_NOTE = '__opening_balance__';

export interface OpeningBalance {
  id: string;
  amount: number;
  at: string;
}

async function userId(): Promise<string | null> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  return user?.id ?? null;
}

export function useFinance(): Finance {
  const [loading, setLoading] = useState(true);
  const [imp, setImp] = useState<ImportRow | null>(null);
  const [fs, setFs] = useState<FinancialState | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [smart, setSmart] = useState<Insight[]>([]);
  const [profileName, setProfileName] = useState('');
  const [history, setHistory] = useState<ImportRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [manual, setManual] = useState<ManualRow[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([]);
  const [planState, setPlanState] = useState<PlanState>({});
  const [balanceSet, setBalanceSet] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<OpeningBalance | null>(null);
  const [mealCard, setMealCard] = useState(0);
  const [allocatedGoalIds, setAllocatedGoalIds] = useState<string[]>([]);
  const planMonth = monthKey(new Date());

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: imports } = await supabase
      .from('imports')
      .select('id,bank,statement_month,income,expenses,housing_fixed')
      .eq('status', 'ready')
      .order('statement_month', { ascending: false })
      .limit(12);
    const latest = (imports?.[0] as ImportRow | undefined) ?? null;
    setImp(latest);
    setHistory([...((imports ?? []) as ImportRow[])].reverse());

    const [{ data: goalData }, { data: limitData }, { data: manualData }, { data: wdData }, { data: allocData }] = await Promise.all([
      supabase.from('goals').select('id,name,icon_key,target_eur,current_eur,target_month,target_year,monthly_allocation,allocation_day').order('created_at'),
      supabase.from('category_limits').select('category,limit_eur'),
      supabase.from('manual_entries').select('id,month,entry_type,amount,category,note,meal_card,created_at').eq('month', planMonth).order('created_at', { ascending: false }),
      supabase.from('goal_withdrawals').select('amount').eq('month', planMonth),
      supabase.from('goal_monthly_allocations').select('goal_id').eq('month', planMonth),
    ]);

    // Perfil resiliente: meal_card_eur pode não existir ainda (migração 0006).
    let profData: { name?: string | null; meal_card_eur?: number | null } = {};
    const withMeal = await supabase.from('profiles').select('name,meal_card_eur').limit(1).maybeSingle();
    if (withMeal.error) {
      const nameOnly = await supabase.from('profiles').select('name').limit(1).maybeSingle();
      profData = (nameOnly.data ?? {}) as typeof profData;
    } else {
      profData = (withMeal.data ?? {}) as typeof profData;
    }
    setProfileName(profData.name ?? '');
    const mealCardVal = profData.meal_card_eur != null ? Number(profData.meal_card_eur) : 0;
    setMealCard(mealCardVal);
    const doneAllocIds = ((allocData ?? []) as { goal_id: string }[]).map((a) => a.goal_id);
    setAllocatedGoalIds(doneAllocIds);

    // Saldo real: o movimento de ABERTURA (nota-sentinela) é a âncora; os
    // restantes movimentos manuais registados DEPOIS dela ajustam-no. Assim o
    // saldo aparece nos movimentos e o cashflow deriva dele. Os movimentos de
    // abertura NUNCA contam como receita/despesa do mês (são o ponto de partida).
    const manualAll = (manualData ?? []) as (ManualRow & { created_at?: string })[];
    const openingRows = manualAll
      .filter((m) => m.note === OPENING_NOTE)
      .sort((a, b) => ((a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1));
    const opening = openingRows[0] ?? null;
    const flowRows = manualAll.filter((m) => m.note !== OPENING_NOTE);

    setBalanceSet(opening !== null);
    setOpeningBalance(opening ? { id: opening.id, amount: Number(opening.amount), at: opening.created_at ?? '' } : null);

    let balanceInput: { anchor: number; adjustedNet: number } | null = null;
    if (opening) {
      let adjustedNet = 0;
      for (const m of flowRows) {
        if (opening.created_at && m.created_at && m.created_at < opening.created_at) continue;
        if (m.meal_card) continue; // pago com o cartão refeição — não sai da conta
        adjustedNet += (m.entry_type === 'income' ? 1 : -1) * Number(m.amount);
      }
      balanceInput = { anchor: Number(opening.amount), adjustedNet: Math.round(adjustedNet * 100) / 100 };
    }

    const goalRows = (goalData ?? []) as GoalRow[];
    const limitMap: Record<string, number> = {};
    for (const l of limitData ?? []) limitMap[l.category] = Number(l.limit_eur);
    // A lista de movimentos exposta à UI exclui o de abertura (mostrado à parte).
    const manualRows = flowRows as ManualRow[];
    const withdrawn = (wdData ?? []).reduce((a, b) => a + Number(b.amount), 0);

    setGoals(goalRows);
    setLimits(limitMap);
    setManual(manualRows);

    if (!latest) {
      setFs(null);
      setAnalysis(null);
      setSmart([]);
      setSubs([]);
      setTxs([]);
      setCategorySpend([]);
      setLoading(false);
      return;
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
    const spend: CategorySpend[] = [...byCat.entries()].map(([categoryId, { amount, count }]) => ({
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

    const a = generateAnalysis({
      income: Number(latest.income),
      expenses: Number(latest.expenses),
      categorySpend: spend,
      subs: coreSubs,
    });

    const pState: PlanState = {};
    for (const row of planData ?? []) {
      if (row.item_key) pState[row.item_key] = { state: row.state as PlanItemStatus };
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

    const coreManual: ManualEntry[] = manualRows.map((m) => ({
      id: m.id,
      month: m.month,
      type: m.entry_type,
      amount: Number(m.amount),
      category: m.category,
      viaMealCard: m.meal_card === true,
    }));
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

    const now = new Date();
    const state = computeFinancialState({
      imported: true,
      income: Number(latest.income),
      expenses: Number(latest.expenses),
      housingFixed: Number(latest.housing_fixed),
      baseLeak: a.baseLeak,
      subs: coreSubs,
      planItems: a.planItems,
      planState: pState,
      goals: coreGoals,
      categoryLimits: limitMap as CategoryLimits,
      categorySpend: spend,
      manualEntries: coreManual,
      mealCardMonthly: mealCardVal,
      allocatedGoalIds: doneAllocIds,
      withdrawnThisMonth: withdrawn,
      planMonth,
      today: now,
      balance: balanceInput,
    });

    // Insights inteligentes — regras determinísticas sobre os movimentos reais
    const txLite: TxLite[] = (txData ?? []).map((t) => ({
      date: t.tx_date as string,
      description: t.description as string,
      amount: Number(t.amount),
      type: t.tx_type as 'income' | 'expense',
      category: t.category as string,
    }));
    const smartList = generateSmartInsights({
      income: Number(latest.income),
      expenses: Number(latest.expenses),
      categorySpend: spend,
      subs: coreSubs,
      transactions: txLite,
      goals: coreGoals,
      goalProjections: state.goalProjections,
      analysis: a,
      today: now,
    });

    setSubs(subRows);
    setTxs(
      ((txData ?? []) as TxRow[]).slice().sort((a2, b2) => (a2.tx_date < b2.tx_date ? 1 : -1)),
    );
    setAnalysis(a);
    setSmart(smartList);
    setPlanState(pState);
    setCategorySpend(spend);
    setFs(state);
    setLoading(false);
  }, [planMonth]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setSubVerdict = useCallback(
    async (id: string, status: SubscriptionStatus) => {
      await createClient().from('subscriptions').update({ user_status: status }).eq('id', id);
      await reload();
    },
    [reload],
  );

  const setBalance = useCallback(
    async (eur: number) => {
      const uid = await userId();
      // amount tem CHECK > 0 no schema; o saldo de abertura é "quanto tens",
      // por isso exigimos ≥ 0 e guardamos ≥ 0.01 para respeitar a constraint.
      if (!uid || Number.isNaN(eur) || eur < 0) return;
      const supabase = createClient();
      // Substitui qualquer abertura anterior deste mês → nova âncora "agora".
      await supabase.from('manual_entries').delete().eq('user_id', uid).eq('month', planMonth).eq('note', OPENING_NOTE);
      await supabase.from('manual_entries').insert({
        user_id: uid,
        month: planMonth,
        entry_type: 'income',
        amount: Math.max(0.01, eur),
        category: 'outros',
        note: OPENING_NOTE,
      });
      await reload();
    },
    [planMonth, reload],
  );

  const setMealCardValue = useCallback(
    async (eur: number) => {
      const uid = await userId();
      if (!uid || Number.isNaN(eur) || eur < 0) return;
      await createClient().from('profiles').update({ meal_card_eur: eur }).eq('id', uid);
      await reload();
    },
    [reload],
  );

  const clearBalance = useCallback(async () => {
    const uid = await userId();
    if (!uid) return;
    await createClient().from('manual_entries').delete().eq('user_id', uid).eq('month', planMonth).eq('note', OPENING_NOTE);
    await reload();
  }, [planMonth, reload]);

  const addSubscription = useCallback(
    async (name: string, price: number) => {
      const uid = await userId();
      if (!uid || !name.trim() || !(price > 0)) return;
      // import_id null = manual; sobrevive a reimportações. Começa 'unknown'
      // para a app perguntar "usas?" como nas detetadas.
      await createClient().from('subscriptions').insert({ user_id: uid, import_id: null, name: name.trim(), price });
      await reload();
    },
    [reload],
  );

  const removeSubscription = useCallback(
    async (id: string) => {
      await createClient().from('subscriptions').delete().eq('id', id);
      await reload();
    },
    [reload],
  );

  const setPlanItemState = useCallback(
    async (itemKey: string, state: PlanItemStatus, title: string, saving: number) => {
      if (!imp) return;
      const supabase = createClient();
      const uid = await userId();
      if (!uid) return;
      const { data: updated } = await supabase
        .from('plan_items')
        .update({ state, monthly_saving: saving })
        .eq('import_id', imp.id)
        .eq('item_key', itemKey)
        .select('id');
      if (!updated || updated.length === 0) {
        await supabase.from('plan_items').insert({
          user_id: uid,
          import_id: imp.id,
          item_key: itemKey,
          title,
          monthly_saving: saving,
          state,
        });
      }
      await reload();
    },
    [imp, reload],
  );

  const saveGoal = useCallback(
    async (draft: GoalDraft) => {
      const supabase = createClient();
      const uid = await userId();
      if (!uid) return;
      const row = {
        name: draft.name,
        icon_key: draft.icon_key,
        target_eur: draft.target_eur,
        current_eur: draft.current_eur,
        target_month: draft.target_month,
        target_year: draft.target_year,
        monthly_allocation: draft.monthly_allocation,
        allocation_day: draft.allocation_day,
      };
      if (draft.id) await supabase.from('goals').update(row).eq('id', draft.id);
      else await supabase.from('goals').insert({ ...row, user_id: uid });
      await reload();
    },
    [reload],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      await createClient().from('goals').delete().eq('id', id);
      await reload();
    },
    [reload],
  );

  const setAllocation = useCallback(
    async (id: string, value: number) => {
      await createClient().from('goals').update({ monthly_allocation: Math.max(0, value) }).eq('id', id);
      await reload();
    },
    [reload],
  );

  const withdrawFromGoal = useCallback(
    async (id: string, amount: number) => {
      const supabase = createClient();
      const uid = await userId();
      const goal = goals.find((g) => g.id === id);
      if (!uid || !goal || amount <= 0) return;
      const capped = Math.min(amount, Number(goal.current_eur));
      if (capped <= 0) return;
      // O dinheiro sai da reserva da meta e volta ao disponível do mês.
      await supabase.from('goals').update({ current_eur: Number(goal.current_eur) - capped }).eq('id', id);
      await supabase.from('goal_withdrawals').insert({ user_id: uid, goal_id: id, amount: capped, month: planMonth });
      await reload();
    },
    [goals, planMonth, reload],
  );

  const markGoalAllocated = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const uid = await userId();
      const goal = goals.find((g) => g.id === id);
      if (!uid || !goal) return;
      const amount = Number(goal.monthly_allocation) || 0;
      if (amount <= 0) return;
      // Regista a alocação do mês (idempotente por meta+mês) e faz avançar o
      // progresso da meta. O dinheiro já saiu da conta → deixa de ser descontado.
      const { error } = await supabase
        .from('goal_monthly_allocations')
        .insert({ user_id: uid, goal_id: id, month: planMonth, amount });
      if (error) return; // já estava marcado (violação de UNIQUE)
      await supabase.from('goals').update({ current_eur: Number(goal.current_eur) + amount }).eq('id', id);
      await reload();
    },
    [goals, planMonth, reload],
  );

  const unmarkGoalAllocated = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const uid = await userId();
      const goal = goals.find((g) => g.id === id);
      if (!uid || !goal) return;
      const { data: row } = await supabase
        .from('goal_monthly_allocations')
        .select('amount')
        .eq('goal_id', id)
        .eq('month', planMonth)
        .maybeSingle();
      if (!row) return;
      await supabase.from('goal_monthly_allocations').delete().eq('goal_id', id).eq('month', planMonth);
      const back = Math.max(0, Number(goal.current_eur) - Number((row as { amount: number }).amount));
      await supabase.from('goals').update({ current_eur: back }).eq('id', id);
      await reload();
    },
    [goals, planMonth, reload],
  );

  const setLimit = useCallback(
    async (category: string, eur: number) => {
      const supabase = createClient();
      const uid = await userId();
      if (!uid || eur < 0) return;
      await supabase.from('category_limits').upsert({ user_id: uid, category, limit_eur: eur }, { onConflict: 'user_id,category' });
      await reload();
    },
    [reload],
  );

  const clearLimit = useCallback(
    async (category: string) => {
      const supabase = createClient();
      const uid = await userId();
      if (!uid) return;
      await supabase.from('category_limits').delete().eq('user_id', uid).eq('category', category);
      await reload();
    },
    [reload],
  );

  const addManual = useCallback(
    async (entry: { type: 'income' | 'expense'; amount: number; category: CategoryKey; note: string; mealCard?: boolean }) => {
      const supabase = createClient();
      const uid = await userId();
      if (!uid || entry.amount <= 0) return;
      await supabase.from('manual_entries').insert({
        user_id: uid,
        month: planMonth,
        entry_type: entry.type,
        amount: entry.amount,
        category: entry.category,
        note: entry.note || null,
        meal_card: entry.type === 'expense' && entry.mealCard === true,
      });
      await reload();
    },
    [planMonth, reload],
  );

  const removeManual = useCallback(
    async (id: string) => {
      await createClient().from('manual_entries').delete().eq('id', id);
      await reload();
    },
    [reload],
  );

  return {
    loading,
    imported: imp !== null,
    profileName,
    history,
    imp,
    fs,
    analysis,
    smart,
    subs,
    txs,
    goals,
    limits,
    manual,
    categorySpend,
    planState,
    planMonth,
    balanceSet,
    openingBalance,
    mealCard,
    reload,
    setBalance,
    setMealCardValue,
    clearBalance,
    setSubVerdict,
    addSubscription,
    removeSubscription,
    setPlanItemState,
    saveGoal,
    deleteGoal,
    setAllocation,
    withdrawFromGoal,
    markGoalAllocated,
    unmarkGoalAllocated,
    allocatedGoalIds,
    setLimit,
    clearLimit,
    addManual,
    removeManual,
  };
}
