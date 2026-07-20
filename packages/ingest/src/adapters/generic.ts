import type { ColumnMapping, ParsedTransaction } from '../types.js';
import { IngestError } from '../types.js';
import { parseEuroAmount, parseStatementDate } from '../values.js';

/**
 * Mapeador universal — o fallback para qualquer banco: o utilizador indica
 * quais são as colunas de data, descritivo e valor (única assinada, ou
 * débito+crédito) e o parsing é 100% determinístico a partir daí.
 */
export function parseWithMapping(rows: string[][], mapping: ColumnMapping): ParsedTransaction[] {
  const hasSigned = typeof mapping.amountCol === 'number';
  const hasSplit = typeof mapping.debitCol === 'number' && typeof mapping.creditCol === 'number';
  if (!hasSigned && !hasSplit) {
    throw new IngestError('bad_mapping', 'Mapeamento sem coluna de valor');
  }

  const out: ParsedTransaction[] = [];
  for (const row of rows.slice(mapping.headerRow + 1)) {
    const date = parseStatementDate(row[mapping.dateCol] ?? '');
    if (!date) continue;
    const description = (row[mapping.descriptionCol] ?? '').trim();
    if (hasSigned) {
      const amount = parseEuroAmount(row[mapping.amountCol!] ?? '');
      if (Number.isNaN(amount) || amount === 0) continue;
      out.push({ date, description, amount: Math.abs(amount), type: amount < 0 ? 'expense' : 'income' });
    } else {
      const debit = parseEuroAmount(row[mapping.debitCol!] ?? '');
      const credit = parseEuroAmount(row[mapping.creditCol!] ?? '');
      if (!Number.isNaN(debit) && debit !== 0) {
        out.push({ date, description, amount: Math.abs(debit), type: 'expense' });
      } else if (!Number.isNaN(credit) && credit !== 0) {
        out.push({ date, description, amount: Math.abs(credit), type: 'income' });
      }
    }
  }
  if (out.length === 0) throw new IngestError('no_valid_rows', 'Mapeamento: sem movimentos válidos');
  return out;
}
