'use client';

// O elo entre a base de dados e o motor: carrega o mês importado, gera a
// análise (função pura) e calcula o estado financeiro completo. Todas as
// vistas leem daqui — a fonte única de verdade. Fase 4: objetivos, limites
// por categoria e movimentos manuais entram no cálculo.

import { useCallback, useEffect, useRef, useState } from 'react';
import { isDemoActive, buildDemoFinance, emptyDemoOverrides, DEMO_PROFILE_NAME, type DemoOverrides } from './demo';
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
  /** Instante em que a despesa saiu da conta; null/ausente = por pagar (0016). */
  paid_at?: string | null;
  created_at?: string;
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
  addManual: (entry: {
    type: 'income' | 'expense';
    amount: number;
    category: CategoryKey;
    note: string;
    mealCard?: boolean;
    paid?: boolean;
  }) => Promise<void>;
  /** Marca uma despesa como já saída da conta (ou volta a pô-la por pagar). */
  setManualPaid: (id: string, paid: boolean) => Promise<void>;
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

  // Overrides interativos do modo-demo (subs canceladas, plano feito) — em ref
  // para o reload ler sempre o valor mais recente sem recriar o callback.
  const demoOv = useRef<DemoOverrides>(emptyDemoOverrides());

  const reload = useCallback(async () => {
    // ── Modo demonstração: tudo em memória, pelo mesmo motor, zero base de dados ──
    if (isDemoActive()) {
      const d = buildDemoFinance(planMonth, demoOv.current);
      setImp(d.imp);
      setHistory(d.history);
      setProfileName(DEMO_PROFILE_NAME);
      setGoals(d.goals);
      setLimits({});
      setManual([]);
      setMealCard(0);
      setAllocatedGoalIds([]);
      setBalanceSet(false);
      setOpeningBalance(null);
      setCategorySpend(d.categorySpend);
      setSubs(d.subs);
      setTxs(d.txs);
      setAnalysis(d.analysis);
      setSmart(d.smart);
      setPlanState(d.planState);
      setFs(d.fs);
      setLoading(false);
      return;
    }

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
      supabase.from('manual_entries').select('id,month,entry_type,amount,category,note,meal_card,paid_at,created_at').eq('month', planMonth).order('created_at', { ascending: false }),
      supabase.from('goal_withdrawals').select('amount,created_at').eq('month', planMonth),
      supabase.from('goal_monthly_allocations').select('goal_id,amount,created_at').eq('month', planMonth),
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
    const allocRows = (allocData ?? []) as { goal_id: string; amount: number; created_at?: string }[];
    const doneAllocIds = allocRows.map((a) => a.goal_id);
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

    // Só o que já mexeu MESMO na conta DEPOIS da âncora ajusta o saldo. A
    // pergunta que cada movimento tem de responder é uma só: o saldo que a
    // pessoa copiou do banco já te inclui? Para uma receita isso decide-se pela
    // data em que foi registada; para uma despesa, pela data em que foi PAGA —
    // uma conta apontada a 19 e paga a 25 saiu depois de uma âncora do dia 20,
    // por muito que tenha sido escrita antes. Uma despesa por pagar nunca entra
    // aqui: não baixa o saldo, baixa o disponível, e disso trata o core através
    // de `unpaidExpenses`.
    let balanceInput: { anchor: number; adjustedNet: number } | null = null;
    if (opening) {
      const anchorAt = opening.created_at ?? '';
      let adjustedNet = 0;
      for (const m of flowRows) {
        if (m.meal_card) continue; // pago com o cartão refeição — não sai da conta
        const movedAt = m.entry_type === 'expense' ? m.paid_at : m.created_at;
        if (!movedAt) continue; // despesa ainda por pagar
        if (anchorAt && movedAt < anchorAt) continue; // a âncora já reflete isto
        adjustedNet += (m.entry_type === 'income' ? 1 : -1) * Number(m.amount);
      }
      // "Já aloquei" é uma transferência: o dinheiro sai da conta e entra na
      // meta. O progresso da meta já subia, mas o saldo ficava quieto — e como
      // a meta deixava de estar reservada, o disponível SUBIA ao alocar, que é
      // o contrário do que acontece na vida. Baixar aqui o saldo fecha a conta:
      // o reservado desaparece, o saldo desce o mesmo valor, o disponível não
      // se mexe. Vale a mesma regra do resto: só as alocações feitas DEPOIS da
      // âncora, porque uma anterior já está refletida no saldo do banco.
      for (const a of allocRows) {
        if (anchorAt && a.created_at && a.created_at < anchorAt) continue;
        adjustedNet -= Number(a.amount);
      }
      // Levantar de uma meta é a mesma transferência ao contrário: o dinheiro
      // volta da meta para a conta, por isso o saldo tem de subir.
      for (const w of (wdData ?? []) as { amount: number; created_at?: string }[]) {
        if (anchorAt && w.created_at && w.created_at < anchorAt) continue;
        adjustedNet += Number(w.amount);
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
      paid: m.paid_at != null,
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
      if (isDemoActive()) {
        demoOv.current.subStatus[id] = status;
        await reload();
        return;
      }
      await createClient().from('subscriptions').update({ user_status: status }).eq('id', id);
      await reload();
    },
    [reload],
  );

  const setBalance = useCallback(
    async (eur: number) => {
      if (isDemoActive()) return;
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
      if (isDemoActive()) return;
      const uid = await userId();
      if (!uid || Number.isNaN(eur) || eur < 0) return;
      await createClient().from('profiles').update({ meal_card_eur: eur }).eq('id', uid);
      await reload();
    },
    [reload],
  );

  const clearBalance = useCallback(async () => {
    if (isDemoActive()) return;
    const uid = await userId();
    if (!uid) return;
    await createClient().from('manual_entries').delete().eq('user_id', uid).eq('month', planMonth).eq('note', OPENING_NOTE);
    await reload();
  }, [planMonth, reload]);

  const addSubscription = useCallback(
    async (name: string, price: number) => {
      if (isDemoActive()) return;
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
      if (isDemoActive()) return;
      await createClient().from('subscriptions').delete().eq('id', id);
      await reload();
    },
    [reload],
  );

  const setPlanItemState = useCallback(
    async (itemKey: string, state: PlanItemStatus, title: string, saving: number) => {
      if (isDemoActive()) {
        demoOv.current.planState[itemKey] = { state };
        await reload();
        return;
      }
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
      if (isDemoActive()) return;
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
      if (isDemoActive()) return;
      await createClient().from('goals').delete().eq('id', id);
      await reload();
    },
    [reload],
  );

  const setAllocation = useCallback(
    async (id: string, value: number) => {
      if (isDemoActive()) return;
      await createClient().from('goals').update({ monthly_allocation: Math.max(0, value) }).eq('id', id);
      await reload();
    },
    [reload],
  );

  const withdrawFromGoal = useCallback(
    async (id: string, amount: number) => {
      if (isDemoActive()) return;
      const supabase = createClient();
      const uid = await userId();
      if (!uid || amount <= 0) return;
      // O dinheiro sai da reserva da meta e volta ao disponível do mês. A conta é
      // feita na base de dados sobre o saldo atual (ver goal_adjust), que também
      // trava no zero e devolve quanto saiu mesmo — é esse valor que fica no
      // histórico, não o que foi pedido.
      const { data: applied } = await supabase.rpc('goal_adjust', { p_goal_id: id, p_delta: -amount });
      const taken = -Number(applied ?? 0);
      if (taken <= 0) return;
      await supabase.from('goal_withdrawals').insert({ user_id: uid, goal_id: id, amount: taken, month: planMonth });
      await reload();
    },
    [planMonth, reload],
  );

  const markGoalAllocated = useCallback(
    async (id: string) => {
      if (isDemoActive()) return;
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
      await supabase.rpc('goal_adjust', { p_goal_id: id, p_delta: amount });
      await reload();
    },
    [goals, planMonth, reload],
  );

  const unmarkGoalAllocated = useCallback(
    async (id: string) => {
      if (isDemoActive()) return;
      const supabase = createClient();
      // Apagar e ler o valor apagado na mesma instrução: de dois cliques
      // seguidos só um recebe a linha de volta, logo só um desfaz a alocação.
      const { data: removed } = await supabase
        .from('goal_monthly_allocations')
        .delete()
        .eq('goal_id', id)
        .eq('month', planMonth)
        .select('amount');
      const amount = Number(removed?.[0]?.amount ?? 0);
      if (amount <= 0) return;
      await supabase.rpc('goal_adjust', { p_goal_id: id, p_delta: -amount });
      await reload();
    },
    [planMonth, reload],
  );

  const setLimit = useCallback(
    async (category: string, eur: number) => {
      if (isDemoActive()) return;
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
      if (isDemoActive()) return;
      const supabase = createClient();
      const uid = await userId();
      if (!uid) return;
      await supabase.from('category_limits').delete().eq('user_id', uid).eq('category', category);
      await reload();
    },
    [reload],
  );

  const addManual = useCallback(
    async (entry: {
      type: 'income' | 'expense';
      amount: number;
      category: CategoryKey;
      note: string;
      mealCard?: boolean;
      paid?: boolean;
    }) => {
      if (isDemoActive()) return;
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
        // Só uma despesa da conta tem estado por pagar. Uma receita já entrou e
        // uma despesa do cartão refeição sai do cartão, não da conta — ambas
        // nascem resolvidas, com o instante a ser o do próprio registo.
        paid_at: entry.type !== 'expense' || entry.mealCard === true || entry.paid === true ? new Date().toISOString() : null,
      });
      await reload();
    },
    [planMonth, reload],
  );

  const setManualPaid = useCallback(
    async (id: string, paid: boolean) => {
      if (isDemoActive()) return;
      await createClient()
        .from('manual_entries')
        .update({ paid_at: paid ? new Date().toISOString() : null })
        .eq('id', id);
      await reload();
    },
    [reload],
  );

  const removeManual = useCallback(
    async (id: string) => {
      if (isDemoActive()) return;
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
    setManualPaid,
    removeManual,
  };
}
