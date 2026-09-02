import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CategoryKey, PlanItemStatus } from '@optifi/core';
import { financeWrites, loadFinanceSnapshot, type FinanceSnapshot, type GoalRow } from '@optifi/data';
import { supabase } from './supabase';

export type { FinanceSnapshot };

/**
 * As regras do dinheiro (a âncora do saldo, uma despesa contar pelo `paid_at`,
 * alocar a uma meta ser uma transferência) vivem todas no `@optifi/data`. A app
 * nativa e a web chamam as mesmas funções — de leitura e de escrita — por isso
 * não há forma de mostrarem saldos diferentes.
 */
export function loadFinance(): Promise<FinanceSnapshot> {
  return loadFinanceSnapshot(supabase);
}

type SharedWrites = Omit<
  ReturnType<typeof financeWrites>,
  'planMonth' | 'setPlanItemState' | 'markGoalAllocated' | 'setTxCategory' | 'reanalyze'
>;

interface FinanceValue extends SharedWrites {
  fin: FinanceSnapshot | null;
  error: string | null;
  /** Só no primeiro carregamento — a atualização puxando para baixo não conta. */
  loading: boolean;
  reload: () => Promise<void>;
  /** O item do plano pertence ao mês importado; o id vem daqui, não da vista. */
  setPlanItemState: (itemKey: string, state: PlanItemStatus, title: string, saving: number) => Promise<void>;
  /** Marcar a alocação precisa da meta inteira; a vista só tem o id. */
  markGoalAllocated: (id: string) => Promise<void>;
  /** Categoria de um COMERCIANTE (não de uma linha) — vale para todos os meses. */
  setTxCategory: (merchant: string, category: CategoryKey) => Promise<void>;
  /** Recategoriza o que já foi importado; devolve quantas linhas mudaram. */
  reanalyze: () => Promise<number>;
}

const Ctx = createContext<FinanceValue | null>(null);

/**
 * Um carregamento para a app inteira. Cada separador ler por si dava cinco
 * viagens à base de dados e, pior, números a saltar quando um separador
 * carregasse antes de outro — o saldo no Início não pode discordar do saldo
 * nas Metas.
 */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [fin, setFin] = useState<FinanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setFin(await loadFinance());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  // As escritas montam-se uma vez só; os refs dão-lhes sempre o estado atual
  // sem as obrigar a remontar. Recarregar tudo depois de cada escrita é uma
  // viagem a mais à base de dados, mas garante que o ecrã nunca mostra um
  // número que a app já mudou — o erro que se paga caro numa app de dinheiro.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const finRef = useRef(fin);
  finRef.current = fin;

  const writes = useMemo(() => {
    const w = financeWrites(supabase);
    const after =
      <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
      async (...args: A) => {
        await fn(...args);
        await reloadRef.current();
      };
    return {
      setBalance: after(w.setBalance),
      clearBalance: after(w.clearBalance),
      setMealCardValue: after(w.setMealCardValue),
      setSubVerdict: after(w.setSubVerdict),
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
      setPlanItemState: async (itemKey: string, state: PlanItemStatus, title: string, saving: number) => {
        const imp = finRef.current?.imp;
        if (!imp) return;
        await w.setPlanItemState(imp.id, itemKey, state, title, saving);
        await reloadRef.current();
      },
      setTxCategory: after(async (merchant: string, category: CategoryKey) => {
        await w.setTxCategory(merchant, category);
      }),
      reanalyze: async () => {
        const { changed } = await w.reanalyze();
        await reloadRef.current();
        return changed;
      },
      markGoalAllocated: async (id: string) => {
        const goal = finRef.current?.goals.find((g: GoalRow) => g.id === id);
        if (!goal) return;
        await w.markGoalAllocated(goal);
        await reloadRef.current();
      },
    };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<FinanceValue>(
    () => ({ ...writes, fin, error, loading, reload }),
    [writes, fin, error, loading, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance(): FinanceValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFinance fora do FinanceProvider');
  return v;
}
