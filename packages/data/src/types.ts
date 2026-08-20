import type {
  Analysis,
  CategoryKey,
  CategorySpend,
  FinancialState,
  Insight,
  PlanState,
  SubscriptionStatus,
} from '@optifi/core';

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
  /** Instante em que a despesa saiu da conta; null/ausente = por pagar. */
  paid_at?: string | null;
  created_at?: string;
}

export interface TxRow {
  tx_date: string;
  description: string;
  category: CategoryKey;
  amount: number;
  tx_type: 'income' | 'expense';
}

export interface OpeningBalance {
  id: string;
  amount: number;
  at: string;
}

/**
 * Tudo o que uma vista precisa de saber sobre o dinheiro do utilizador, num só
 * objeto. É o retorno de `loadFinanceSnapshot` e a única forma de ler dados
 * financeiros — web e mobile partilham este resultado.
 */
export interface FinanceSnapshot {
  /** Nome do perfil (para a saudação). */
  profileName: string;
  /** Todos os meses importados, ascendente (para o gráfico de cashflow). */
  history: ImportRow[];
  /** O mês importado mais recente; null = ainda não importou nada. */
  imp: ImportRow | null;
  fs: FinancialState | null;
  analysis: Analysis | null;
  /** Insights determinísticos sobre os movimentos reais. */
  smart: Insight[];
  subs: SubRow[];
  /** Movimentos do mês importado, data descendente. */
  txs: TxRow[];
  goals: GoalRow[];
  limits: Record<string, number>;
  /** Movimentos manuais do mês, SEM o movimento de abertura. */
  manual: ManualRow[];
  categorySpend: CategorySpend[];
  planState: PlanState;
  planMonth: string;
  /** True quando existe um movimento de abertura (o saldo está fixado). */
  balanceSet: boolean;
  openingBalance: OpeningBalance | null;
  /** Valor mensal do cartão/ticket refeição (0 = não definido). */
  mealCard: number;
  /** IDs das metas cuja alocação mensal já foi feita este mês. */
  allocatedGoalIds: string[];
}
