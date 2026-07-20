import { categorizeMerchant } from '@optifi/core';
import type { CategorizedTransaction, ParsedTransaction, StatementSummary } from './types.js';
import { IngestError } from './types.js';
import { assignFingerprints } from './fingerprint.js';
import { normalizeDescription } from './values.js';

/**
 * Constrói o resumo do mês fechado a partir dos movimentos normalizados:
 * escolhe o mês dominante do ficheiro (o utilizador pode exportar períodos
 * com dias soltos de meses vizinhos), filtra para esse mês, categoriza,
 * atribui fingerprints e deriva os agregados que alimentam o motor.
 * base_leak NÃO é derivado aqui — as fugas nascem da análise (Fase 3).
 */
export function buildStatement(txs: ParsedTransaction[], endingBalance?: number): StatementSummary {
  if (txs.length === 0) throw new IngestError('no_rows', 'Sem movimentos');

  // Mês dominante ('YYYY-MM' com mais movimentos)
  const byMonth = new Map<string, number>();
  for (const tx of txs) {
    const m = tx.date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  const statementMonth = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]![0];

  const monthTxs = txs.filter((t) => t.date.startsWith(statementMonth));
  const withFp = assignFingerprints(monthTxs);
  const transactions: CategorizedTransaction[] = withFp.map((tx) => ({
    ...tx,
    category: tx.type === 'income' ? 'receita' : categorizeMerchant(tx.description),
  }));

  let income = 0;
  let expenses = 0;
  let housingFixed = 0;
  for (const tx of transactions) {
    if (tx.type === 'income') income += tx.amount;
    else {
      expenses += tx.amount;
      if (tx.category === 'habitacao') housingFixed += tx.amount;
    }
  }

  // Subscrições: despesas da categoria subscricoes, agrupadas por descritivo
  // normalizado; o preço é o valor mais recente (apanha subidas de preço).
  const subsMap = new Map<string, { name: string; price: number; date: string }>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.category !== 'subscricoes') continue;
    const key = normalizeDescription(tx.description);
    const existing = subsMap.get(key);
    if (!existing || tx.date > existing.date) {
      subsMap.set(key, { name: tx.description, price: tx.amount, date: tx.date });
    }
  }
  const subscriptions = [...subsMap.values()]
    .map(({ name, price }) => ({ name, price }))
    .sort((a, b) => b.price - a.price);

  return {
    statementMonth,
    transactions,
    income: round2(income),
    expenses: round2(expenses),
    housingFixed: round2(housingFixed),
    subscriptions,
    ...(endingBalance !== undefined ? { endingBalance: round2(endingBalance) } : {}),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
