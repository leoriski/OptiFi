// Domain types for the OptiFi financial engine.
// Ported from the prototype (OPTIFI2.0/index.html), which is the functional
// specification: field semantics match the prototype's financialState.

/** Expense/income category keys — language-independent ids. */
export type CategoryKey =
  | 'habitacao'
  | 'alimentacao'
  | 'transporte'
  | 'lazer'
  | 'subscricoes'
  | 'saude'
  | 'educacao'
  | 'transferencias'
  | 'receita'
  | 'outros';

/**
 * User verdict on a detected subscription.
 * - unknown:   not reviewed yet
 * - confirmed: user confirmed they use it
 * - rejected:  user marked it as not worth it (but still paying)
 * - cancelled: user cancelled it (no longer paid)
 */
export type SubscriptionStatus = 'unknown' | 'confirmed' | 'rejected' | 'cancelled';

export interface Subscription {
  id: string;
  name: string;
  /** Monthly price in EUR. */
  price: number;
  /** Days since last detected use (drives "suspect" alerts). */
  daysSinceUse?: number;
  suspect?: boolean;
  userStatus: SubscriptionStatus;
}

/** State of one savings-plan item. Resolved items (done/ignored) reduce the leak. */
export type PlanItemStatus = 'active' | 'done' | 'ignored';

export interface PlanItem {
  id: string;
  /** Monthly saving in EUR if the item is acted on. */
  monthlySaving: number;
}

export type PlanState = Record<string, { state: PlanItemStatus } | undefined>;

export interface Goal {
  id: string;
  /** Nome apresentável (opcional no motor; a UI usa-o nos insights). */
  name?: string;
  /** Target amount in EUR. */
  targetEur: number;
  /** Amount reserved so far in EUR. */
  currentEur: number;
  /** Structured target date: month 1..12 + full year. */
  targetMonth?: number;
  targetYear?: number;
  /** How much of the monthly net the user allocates to this goal. */
  monthlyAllocation: number;
  /**
   * Dia do mês (1..28) em que a alocação é reservada. Só a partir desse dia é
   * que o valor conta como reservado (sai do "livre para gastar"); antes disso
   * o dinheiro está livre. Default 1. A projeção usa sempre a alocação mensal.
   */
  allocationDay?: number;
}

export type GoalProjectionState = 'done' | 'allocated' | 'unallocated';

export interface GoalProjection {
  alloc: number;
  remaining: number;
  state: GoalProjectionState;
  /** Months until completion at the current allocation (allocated only). */
  months?: number;
  /** Estimated completion date (first of month). */
  estDate?: Date;
  deadline?: Date | null;
  onTrack?: boolean;
  /** How many months past the deadline the estimate lands (0 when on track). */
  monthsLate?: number;
}

/**
 * A movement the user logs by hand for the CURRENT month (e.g. the water bill
 * that arrives mid-month). Kept STRICTLY separate from the imported statement:
 * it influences only the present (freeToSpend, current-month cashflow) and
 * NEVER the closed-month analysis (leak, score, limit calibration).
 */
export interface ManualEntry {
  id: string;
  /** Month the entry belongs to, as an ISO key: 'YYYY-MM'. */
  month: string;
  type: 'income' | 'expense';
  amount: number;
  category?: CategoryKey;
  note?: string;
  /**
   * Despesa paga com o CARTÃO REFEIÇÃO: sai do saldo do cartão, não da conta
   * bancária — fica fora do saldo/entradas-saídas/limites e conta no pote
   * do cartão (recebido − gasto = restante).
   */
  viaMealCard?: boolean;
  /**
   * A despesa JÁ saiu da conta. Ausente/false = está registada mas ainda por
   * pagar — o gesto normal é registar o que há a pagar logo a seguir a receber
   * o salário, e nessa altura o dinheiro ainda lá está. Uma despesa por pagar
   * não baixa o saldo, baixa o que podes gastar; ao marcá-la como paga o valor
   * passa de um lado para o outro e o disponível não se mexe.
   */
  paid?: boolean;
}

/** Spend per limit-able category in the analyzed (imported) month. */
export interface CategorySpend {
  /** Language-independent category id (the prototype keys limits by cat_en). */
  categoryId: string;
  amount: number;
  /** Nº de movimentos na categoria neste mês — para deteção de frequência. */
  count?: number;
}

/** Monthly ceilings chosen by the user, keyed by category id. */
export type CategoryLimits = Record<string, number>;

export type CategoryLimitStatus = 'ok' | 'tight' | 'over';

export interface CategoryLimitState {
  spent: number;
  limit: number;
  overBy: number;
  state: CategoryLimitStatus;
}
