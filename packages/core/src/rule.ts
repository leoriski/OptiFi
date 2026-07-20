import type { CategorySpend } from './types.js';

/**
 * Regra 50/30/20 PERSONALIZADA — a ideia clássica (50% essenciais, 30%
 * pessoais, 20% poupança) aplicada às finanças REAIS de cada pessoa, não ao
 * livro: os essenciais são o que o utilizador de facto gasta em casa, comida
 * de supermercado, saúde, educação e transporte no mês analisado. Daí nasce a
 * regra dele — pode ser 60/24/16 ou 42/35/23. O resto do rendimento divide-se
 * na proporção clássica dos não-essenciais (30/20 → 60%/40%).
 */

/** Categorias que contam como ESSENCIAIS (comer fora é lazer → pessoais). */
export const NEEDS_CATEGORIES = ['habitacao', 'alimentacao', 'saude', 'educacao', 'transporte'] as const;

export interface BudgetRule {
  /** Percentagens inteiras que somam 100 — a "regra {needs}/{wants}/{savings}". */
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  /** Essenciais reais do mês analisado (o que definiu a regra). */
  needsEur: number;
  /** Sugestões em euros para o rendimento atual. */
  wantsEur: number;
  savingsEur: number;
  /** O que foi de facto gasto em pessoais (lazer + subscrições + outros). */
  wantsActualEur: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Deriva a regra a partir do rendimento e do gasto por categoria do mês
 * analisado. Devolve null sem rendimento (não há regra sem base honesta).
 */
export function computeBudgetRule(income: number, categorySpend: CategorySpend[]): BudgetRule | null {
  if (!(income > 0)) return null;

  let needs = 0;
  let wantsActual = 0;
  for (const row of categorySpend) {
    if (row.categoryId === 'receita') continue;
    if ((NEEDS_CATEGORIES as readonly string[]).includes(row.categoryId)) needs += row.amount;
    else wantsActual += row.amount;
  }

  // Percentagem dos essenciais, limitada a 90% — acima disso a regra ainda
  // existe mas com margens mínimas (a app não finge que dá para poupar 20%).
  const needsPct = Math.min(90, Math.max(0, Math.round((needs / income) * 100)));
  const remaining = 100 - needsPct;
  // Proporção clássica dos não-essenciais: 30/20 → 60% pessoais, 40% poupança.
  const wantsPct = Math.round(remaining * 0.6);
  const savingsPct = 100 - needsPct - wantsPct;

  return {
    needsPct,
    wantsPct,
    savingsPct,
    needsEur: round2(needs),
    wantsEur: round2((income * wantsPct) / 100),
    savingsEur: round2((income * savingsPct) / 100),
    wantsActualEur: round2(wantsActual),
  };
}
