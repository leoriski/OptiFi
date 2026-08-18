import { baseServiceName, categorizeMerchant, type CategoryKey } from '@optifi/core';
import type { CategorizedTransaction, ParsedTransaction, StatementSummary } from './types.js';
import { IngestError } from './types.js';
import { assignFingerprints } from './fingerprint.js';
import { normalizeDescription } from './values.js';

/** Formato do Millennium: dia + código + contraparte ("29 TRF Isabel Jorge Camb"). */
const PEER_TRANSFER = /^\d{1,2}\s+(?:trf|tfi)\s+\S/;

/** Nome da contraparte num descritivo de transferência, sem código nem referência. */
function counterparty(description: string): string {
  return normalizeDescription(description)
    .replace(/^\d{1,2}\s+/, '')
    .replace(/^(?:trf\.?imed\.?|trf\.?|tfi|mb ?way)\s*/, '')
    .replace(/^(?:mb ?way\s*)?(?:p\/o|p\/|para|de)\s+/, '')
    .replace(/-[a-z]?\d+\s*$/, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Categoriza um extrato INTEIRO. Precisa do extrato completo (e não de cada
 * movimento isolado) por causa das transferências no formato do Millennium
 * ("29 TRF Isabel Jorge Camb"), em que o descritivo é só dia + código +
 * contraparte e não diz se é pessoa ou empresa:
 * · nas SAÍDAS é sempre dinheiro enviado a uma contraparte → transferência;
 * · nas ENTRADAS não se pode adivinhar — um ordenado chega no mesmo formato
 *   ("29 TFI PLANO INCLINADO I"). Só vira transferência quando a MESMA
 *   contraparte também recebeu dinheiro nosso no extrato, sinal claro de ser
 *   alguém com quem trocamos dinheiro. Na dúvida fica rendimento: preferimos
 *   contar a mais a inventar um défice que não existe.
 *
 * Nas ENTRADAS, um descritivo de transferência entre pessoas (ex.: "TRF.IMED.
 * DE João" = um amigo a devolver) NÃO é rendimento. Tudo o resto que entra é
 * 'receita' (salário, depósito, reembolso…), mesmo com descritivo desconhecido.
 */
export function categorizeStatement<T extends { description: string; type: 'income' | 'expense' }>(
  txs: T[],
): (T & { category: CategoryKey })[] {
  const out = txs.map((tx) => {
    const cat = categorizeMerchant(tx.description);
    const category: CategoryKey =
      tx.type === 'income'
        ? cat === 'transferencias'
          ? 'transferencias'
          : 'receita'
        : PEER_TRANSFER.test(normalizeDescription(tx.description))
          ? 'transferencias'
          : cat;
    return { ...tx, category };
  });

  const paidOut = new Set(
    out
      .filter((t) => t.type === 'expense' && t.category === 'transferencias')
      .map((t) => counterparty(t.description))
      .filter((n) => n.length >= 6 && n.includes(' ')),
  );
  for (const tx of out) {
    if (tx.type !== 'income' || tx.category !== 'receita') continue;
    if (!PEER_TRANSFER.test(normalizeDescription(tx.description))) continue;
    if (paidOut.has(counterparty(tx.description))) tx.category = 'transferencias';
  }
  return out;
}

/**
 * Subscrições do mês: despesas da categoria 'subscricoes' agrupadas pelo NOME
 * BASE do serviço — sem o dia nem o código de terminal que o banco cola à
 * frente. Sem isto, "02 FITNESS UP GROUP" e "18 FITNESS UP GROUP" apareciam
 * como dois ginásios diferentes e a app pedia para cancelar o mesmo serviço
 * duas vezes. O preço é o que o serviço custou NO MÊS (soma das cobranças),
 * que é a resposta à pergunta "quanto me sai isto por mês".
 *
 * Vive aqui, e não em cada chamador, porque a importação e a re-análise têm de
 * chegar exatamente à mesma lista — senão re-analisar desfazia o agrupamento.
 */
export function groupSubscriptions(
  txs: { description: string; amount: number; date: string; type: 'income' | 'expense'; category: string }[],
): { name: string; price: number }[] {
  const byService = new Map<string, { name: string; price: number; date: string }>();
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.category !== 'subscricoes') continue;
    const key = baseServiceName(tx.description) || normalizeDescription(tx.description);
    const existing = byService.get(key);
    if (!existing) {
      byService.set(key, { name: tx.description, price: tx.amount, date: tx.date });
      continue;
    }
    existing.price = round2(existing.price + tx.amount);
    // O descritivo mais recente é o que o utilizador reconhece hoje.
    if (tx.date >= existing.date) {
      existing.name = tx.description;
      existing.date = tx.date;
    }
  }
  return [...byService.values()].map(({ name, price }) => ({ name, price })).sort((a, b) => b.price - a.price);
}

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
  const transactions: CategorizedTransaction[] = categorizeStatement(withFp);

  // Transferências entre pessoas (dinheiro que apenas circula) NÃO são nem
  // rendimento nem consumo — ficam fora dos totais que alimentam a análise
  // (défice, taxa de poupança, regra). Aparecem à parte na Atividade.
  let income = 0;
  let expenses = 0;
  let housingFixed = 0;
  for (const tx of transactions) {
    if (tx.category === 'transferencias') continue;
    if (tx.type === 'income') income += tx.amount;
    else {
      expenses += tx.amount;
      if (tx.category === 'habitacao') housingFixed += tx.amount;
    }
  }

  const subscriptions = groupSubscriptions(transactions);

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
