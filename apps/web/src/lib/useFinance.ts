'use client';

// O elo entre a base de dados e o motor: carrega o mês importado, gera a
// análise (função pura) e calcula o estado financeiro completo. Todas as
// vistas leem daqui — a fonte única de verdade. Objetivos, limites
// por categoria e movimentos manuais entram no cálculo.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { OPENING_NOTE, financeWrites, loadFinanceSnapshot, type GoalDraft } from '@optifi/data';
import { createClient } from './supabase/client';

// As linhas da base de dados e o carregador vivem no @optifi/data para a app
// nativa ler exatamente os mesmos números. Re-exportadas aqui porque as vistas
// já as importam deste módulo.
export type { GoalRow, ImportRow, ManualRow, OpeningBalance, SubRow, TxRow } from '@optifi/data';
export { OPENING_NOTE };
import type { GoalRow, ImportRow, ManualRow, OpeningBalance, SubRow, TxRow } from '@optifi/data';

export type { GoalDraft };

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

  // As escritas montam-se uma vez só; o ref dá-lhes sempre o recarregamento
  // atual sem as obrigar a remontar a cada render.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    void reload();
  }, [reload]);

  // Todas as escritas de dinheiro vivem no @optifi/data, partilhadas com a app
  // nativa. Uma segunda cópia destas regras aqui acabaria por divergir, e é aí
  // que as duas apps começam a mostrar saldos diferentes. Aqui só se encadeia
  // o recarregamento a seguir a cada escrita.
  const writes = useMemo(() => {
    const w = financeWrites(createClient());
    const after =
      <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
      async (...args: A) => {
        await fn(...args);
        await reloadRef.current();
      };
    return {
      setSubVerdict: after(w.setSubVerdict),
      setBalance: after(w.setBalance),
      setMealCardValue: after(w.setMealCardValue),
      clearBalance: after(w.clearBalance),
      addSubscription: after(w.addSubscription),
      removeSubscription: after(w.removeSubscription),
      saveGoal: after(w.saveGoal),
      deleteGoal: after(w.deleteGoal),
      setAllocation: after(w.setAllocation),
      withdrawFromGoal: after(w.withdrawFromGoal),
      unmarkGoalAllocated: after(w.unmarkGoalAllocated),
      setLimit: after(w.setLimit),
      clearLimit: after(w.clearLimit),
      addManual: after(w.addManual),
      setManualPaid: after(w.setManualPaid),
      removeManual: after(w.removeManual),
      raw: w,
    };
  }, []);

  // As duas que precisam de contexto que só esta camada tem: o item do plano
  // pertence ao mês importado, e marcar uma alocação precisa da meta inteira.
  const setPlanItemState = useCallback(
    async (itemKey: string, state: PlanItemStatus, title: string, saving: number) => {
      if (!imp) return;
      await writes.raw.setPlanItemState(imp.id, itemKey, state, title, saving);
      await reload();
    },
    [imp, reload, writes],
  );

  const markGoalAllocated = useCallback(
    async (id: string) => {
      const goal = goals.find((g) => g.id === id);
      if (!goal) return;
      await writes.raw.markGoalAllocated(goal);
      await reload();
    },
    [goals, reload, writes],
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
    setBalance: writes.setBalance,
    setMealCardValue: writes.setMealCardValue,
    clearBalance: writes.clearBalance,
    setSubVerdict: writes.setSubVerdict,
    addSubscription: writes.addSubscription,
    removeSubscription: writes.removeSubscription,
    setPlanItemState,
    saveGoal: writes.saveGoal,
    deleteGoal: writes.deleteGoal,
    setAllocation: writes.setAllocation,
    withdrawFromGoal: writes.withdrawFromGoal,
    markGoalAllocated,
    unmarkGoalAllocated: writes.unmarkGoalAllocated,
    allocatedGoalIds,
    setLimit: writes.setLimit,
    clearLimit: writes.clearLimit,
    addManual: writes.addManual,
    setManualPaid: writes.setManualPaid,
    removeManual: writes.removeManual,
    setTxCategory,
  };
}
