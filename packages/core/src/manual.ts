import type { ManualEntry } from './types.js';

/** ISO month key ('YYYY-MM') for a date — how manual entries are bucketed. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface ManualSums {
  expenses: number;
  income: number;
  net: number;
}

/**
 * Sum the entries that belong to the current plan month — the only ones that
 * count toward the present. Older entries persist but no longer affect "now".
 */
export function sumManualEntries(entries: ManualEntry[], planMonth: string): ManualSums {
  let expenses = 0;
  let income = 0;
  for (const e of entries) {
    if (!e || e.month !== planMonth) continue;
    // Despesas do cartão refeição saem do CARTÃO, não da conta — não entram
    // no dinheiro do banco (têm o seu próprio pote em sumMealCardSpent).
    if (e.viaMealCard) continue;
    const amt = typeof e.amount === 'number' ? e.amount : 0;
    if (e.type === 'income') income += amt;
    else expenses += amt;
  }
  return { expenses, income, net: income - expenses };
}

/** Total gasto com o cartão refeição no mês corrente. */
export function sumMealCardSpent(entries: ManualEntry[], planMonth: string): number {
  let spent = 0;
  for (const e of entries) {
    if (!e || e.month !== planMonth || !e.viaMealCard || e.type !== 'expense') continue;
    spent += typeof e.amount === 'number' ? e.amount : 0;
  }
  return Math.round(spent * 100) / 100;
}
