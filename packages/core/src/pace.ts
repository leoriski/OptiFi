export interface SafePaceInput {
  income: number;
  /** Total expenses of the analyzed (closed) month. */
  expenses: number;
  /** Monthly cost of subscriptions still being paid. */
  activeSubsTotal: number;
  /** Fixed housing commitment from the statement (rent + utilities). */
  housingFixed: number;
  /** Money the user actively reserved for goals (comes out of the spendable budget). */
  reservedForGoals: number;
}

export type SafePaceStatus = 'empty' | 'good' | 'tight' | 'over';

export interface SafePace {
  income: number;
  expenses: number;
  fixedCommitted: number;
  savingsTarget: number;
  reservedForGoals: number;
  monthlyVariableBudget: number;
  variableSpentLastMonth: number;
  weeklyPace: number;
  dailyPace: number;
  status: SafePaceStatus;
}

/**
 * Recommended spending-pace ceiling derived from last month's behaviour.
 * NOT a live balance — an estimate/guide (honest framing is mandatory in UI).
 * Ported verbatim from the prototype's computeSafePace.
 */
export function computeSafePace(input: SafePaceInput): SafePace {
  const { income, expenses, activeSubsTotal, housingFixed, reservedForGoals } = input;
  const fixedCommitted = activeSubsTotal + housingFixed;
  const savingsTarget = Math.max(0, income * 0.2);
  const reserved = reservedForGoals > 0 ? reservedForGoals : 0;

  const monthlyVariableBudget = Math.max(0, income - fixedCommitted - savingsTarget - reserved);
  const variableSpentLastMonth = Math.max(0, expenses - fixedCommitted);

  const weeklyPace = monthlyVariableBudget / 4.3;
  const dailyPace = monthlyVariableBudget / 30;

  let status: SafePaceStatus;
  if (income <= 0) status = 'empty';
  else if (variableSpentLastMonth <= monthlyVariableBudget) status = 'good';
  else if (variableSpentLastMonth <= monthlyVariableBudget * 1.15) status = 'tight';
  else status = 'over';

  return {
    income,
    expenses,
    fixedCommitted,
    savingsTarget,
    reservedForGoals: reserved,
    monthlyVariableBudget,
    variableSpentLastMonth,
    weeklyPace,
    dailyPace,
    status,
  };
}

/** Days left in the month of `now`, counting today (min 1). */
export function daysLeftInMonth(now: Date): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, daysInMonth - now.getDate() + 1);
}
