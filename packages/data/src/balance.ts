import type { ManualRow } from './types.js';

/**
 * O saldo definido pelo utilizador é guardado como um MOVIMENTO DE ABERTURA
 * real (uma linha em `manual_entries` com esta nota-sentinela), não em
 * localStorage nem numa coluna à parte. Assim aparece nos movimentos e alimenta
 * o cashflow — e persiste sem precisar de nova migração.
 *
 * O valor da constante é dados guardados: mudá-lo faz o saldo de toda a gente
 * desaparecer, porque as linhas antigas deixam de ser encontradas.
 */
export const OPENING_NOTE = '__opening_balance__';

export interface DatedAmount {
  amount: number;
  created_at?: string | null;
}

export interface BalanceAnchor {
  anchor: number;
  adjustedNet: number;
}

/** Separa o movimento de abertura mais recente dos movimentos de fluxo. */
export function splitOpening(rows: ManualRow[]): { opening: ManualRow | null; flow: ManualRow[] } {
  const opening =
    rows
      .filter((m) => m.note === OPENING_NOTE)
      .sort((a, b) => ((a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1))[0] ?? null;
  return { opening, flow: rows.filter((m) => m.note !== OPENING_NOTE) };
}

/**
 * Quanto é que o saldo se mexeu desde a âncora.
 *
 * Só o que já mexeu MESMO na conta DEPOIS da âncora conta. A pergunta que cada
 * movimento tem de responder é uma só: o saldo que a pessoa copiou do banco já
 * te inclui? Para uma receita isso decide-se pela data em que foi registada;
 * para uma despesa, pela data em que foi PAGA — uma conta apontada a 19 e paga
 * a 25 saiu depois de uma âncora do dia 20, por muito que tenha sido escrita
 * antes. Uma despesa por pagar nunca entra aqui: não baixa o saldo, baixa o
 * disponível, e disso trata o core através de `unpaidExpenses`.
 */
export function computeBalanceAnchor(
  opening: ManualRow | null,
  flow: ManualRow[],
  allocations: DatedAmount[],
  withdrawals: DatedAmount[],
): BalanceAnchor | null {
  if (!opening) return null;
  const anchorAt = opening.created_at ?? '';
  let adjustedNet = 0;

  for (const m of flow) {
    if (m.meal_card) continue; // pago com o cartão refeição — não sai da conta
    const movedAt = m.entry_type === 'expense' ? m.paid_at : m.created_at;
    if (!movedAt) continue; // despesa ainda por pagar
    if (anchorAt && movedAt < anchorAt) continue; // a âncora já reflete isto
    adjustedNet += (m.entry_type === 'income' ? 1 : -1) * Number(m.amount);
  }

  // "Já aloquei" é uma transferência: o dinheiro sai da conta e entra na meta.
  // O progresso da meta já subia, mas o saldo ficava quieto — e como a meta
  // deixava de estar reservada, o disponível SUBIA ao alocar, que é o contrário
  // do que acontece na vida. Baixar aqui o saldo fecha a conta: o reservado
  // desaparece, o saldo desce o mesmo valor, o disponível não se mexe.
  for (const a of allocations) {
    if (anchorAt && a.created_at && a.created_at < anchorAt) continue;
    adjustedNet -= Number(a.amount);
  }
  // Levantar de uma meta é a mesma transferência ao contrário: o dinheiro volta
  // da meta para a conta, por isso o saldo tem de subir.
  for (const w of withdrawals) {
    if (anchorAt && w.created_at && w.created_at < anchorAt) continue;
    adjustedNet += Number(w.amount);
  }

  return { anchor: Number(opening.amount), adjustedNet: Math.round(adjustedNet * 100) / 100 };
}
