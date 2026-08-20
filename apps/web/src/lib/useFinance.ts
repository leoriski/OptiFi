'use client';

// O elo entre a base de dados e o motor: carrega o mês importado, gera a
// análise (função pura) e calcula o estado financeiro completo. Todas as
// vistas leem daqui — a fonte única de verdade. Fase 4: objetivos, limites
// por categoria e movimentos manuais entram no cálculo.

import { useCallback, useEffect, useRef, useState } from 'react';
import { isDemoActive, buildDemoFinance, emptyDemoOverrides, DEMO_PROFILE_NAME, type DemoOverrides } from './demo';
import {
  monthKey,
  type Analysis,
  type CategoryKey,
  type CategorySpend,
  type FinancialState,
  type Insight,
  type PlanItemStatus,
  type PlanState,
  type SubscriptionStatus,
} from '@optifi/core';
import { OPENING_NOTE, loadFinanceSnapshot } from '@optifi/data';
import { createClient } from './supabase/client';

// As linhas da base de dados e o carregador vivem no @optifi/data para a app
// nativa ler exatamente os mesmos números. Re-exportadas aqui porque as vistas
// já as importam deste módulo.
export type { GoalRow, ImportRow, ManualRow, OpeningBalance, SubRow, TxRow } from '@optifi/data';
export { OPENING_NOTE };
import type { GoalRow, ImportRow, ManualRow, OpeningBalance, SubRow, TxRow } from '@optifi/data';

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
  /** Regra "este comerciante é desta categoria"; `merchant` é o nome mostrado. */
  setTxCategory: (merchant: string, category: CategoryKey) => Promise<void>;
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

    const snap = await loadFinanceSnapshot(createClient());
    setImp(snap.imp);
    setHistory(snap.history);
    setProfileName(snap.profileName);
    setMealCard(snap.mealCard);
    setAllocatedGoalIds(snap.allocatedGoalIds);
    setBalanceSet(snap.balanceSet);
    setOpeningBalance(snap.openingBalance);
    setGoals(snap.goals);
    setLimits(snap.limits);
    setManual(snap.manual);
    setSubs(snap.subs);
    setTxs(snap.txs);
    setAnalysis(snap.analysis);
    setSmart(snap.smart);
    setPlanState(snap.planState);
    setCategorySpend(snap.categorySpend);
    setFs(snap.fs);
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

  /**
   * "Isto que aparece como X é da categoria Y." Vai à rota em vez de escrever
   * direto na tabela porque a decisão não é só a linha que está no ecrã: cria
   * a regra que sobrevive ao Re-analisar, arruma as outras linhas do mesmo
   * comerciante e refaz os totais do mês. Meio disto feito seria pior do que
   * nada — a análise passaria a assentar em números que já não batem com as
   * categorias.
   */
  const setTxCategory = useCallback(
    async (merchant: string, category: CategoryKey) => {
      if (isDemoActive()) return;
      const res = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant, category }),
      });
      if (!res.ok) return;
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
    setTxCategory,
  };
}
