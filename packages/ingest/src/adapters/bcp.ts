import type { BankAdapter, ParsedTransaction, ParseResult } from '../types.js';
import { IngestError } from '../types.js';
import { parseEuroAmount, parseStatementDate } from '../values.js';

/**
 * Millennium BCP — exportação de movimentos com linhas de contexto antes do
 * cabeçalho. Colunas típicas: Data lançamento ; Data valor ; Descrição ;
 * Montante ; Moeda ; Saldo. Montante único assinado (negativo = débito),
 * formato PT ('1.234,56'), datas DD-MM-YYYY. Cabeçalho localizado por conteúdo.
 */

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function findBcpHeader(rows: string[][]): { index: number; iDate: number; iDesc: number; iAmount: number; iBalance: number } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i]!.map(norm);
    const iDate = cells.findIndex((c) => c.startsWith('data lanc'));
    const iDesc = cells.findIndex((c) => c.startsWith('descri'));
    const iAmount = cells.findIndex((c) => c === 'montante' || c.startsWith('montante'));
    const iBalance = cells.findIndex((c) => c === 'saldo' || c.startsWith('saldo'));
    if (iDate >= 0 && iDesc >= 0 && iAmount >= 0) {
      return { index: i, iDate, iDesc, iAmount, iBalance };
    }
  }
  return null;
}

export const bcpAdapter: BankAdapter = {
  id: 'bcp',

  matches(rows) {
    return findBcpHeader(rows) !== null;
  },

  parse(rows): ParseResult {
    const h = findBcpHeader(rows);
    if (!h) throw new IngestError('unknown_format', 'Millennium: cabeçalho não encontrado');
    const out: ParsedTransaction[] = [];
    let lastDate = '';
    let endingBalance: number | undefined;
    for (const row of rows.slice(h.index + 1)) {
      const date = parseStatementDate(row[h.iDate] ?? '');
      if (!date) continue;
      const amount = parseEuroAmount(row[h.iAmount] ?? '');
      if (Number.isNaN(amount) || amount === 0) continue;
      out.push({
        date,
        description: (row[h.iDesc] ?? '').trim(),
        amount: Math.abs(amount),
        type: amount < 0 ? 'expense' : 'income',
      });
      if (h.iBalance >= 0 && date >= lastDate) {
        const bal = parseEuroAmount(row[h.iBalance] ?? '');
        if (!Number.isNaN(bal)) {
          lastDate = date;
          endingBalance = bal;
        }
      }
    }
    if (out.length === 0) throw new IngestError('no_valid_rows', 'Millennium: sem movimentos válidos');
    return endingBalance !== undefined ? { txs: out, endingBalance } : { txs: out };
  },
};
