import type { BankAdapter, ParsedTransaction, ParseResult } from '../types.js';
import { IngestError } from '../types.js';
import { parseEuroAmount, parseStatementDate } from '../values.js';

/**
 * CGD (Caixadirecta) — CSV ponto-e-vírgula, Windows-1252, com linhas de
 * preâmbulo (conta, período) antes do cabeçalho real e rodapé com saldos.
 * Colunas típicas: Data mov. ; Data valor ; Descrição ; Débito ; Crédito ;
 * Saldo contabilístico ; ... Datas DD-MM-YYYY, valores '1.234,56'.
 * O cabeçalho é localizado por conteúdo (não por posição) — sobrevive a
 * variações no preâmbulo.
 */

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function findCgdHeader(rows: string[][]): { index: number; iDate: number; iDesc: number; iDebit: number; iCredit: number; iBalance: number } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i]!.map(norm);
    const iDate = cells.findIndex((c) => c.startsWith('data mov'));
    const iDesc = cells.findIndex((c) => c.startsWith('descri'));
    const iDebit = cells.findIndex((c) => c.startsWith('debito'));
    const iCredit = cells.findIndex((c) => c.startsWith('credito'));
    const iBalance = cells.findIndex((c) => c.startsWith('saldo contab') || c.startsWith('saldo disp'));
    if (iDate >= 0 && iDesc >= 0 && iDebit >= 0 && iCredit >= 0) {
      return { index: i, iDate, iDesc, iDebit, iCredit, iBalance };
    }
  }
  return null;
}

export const cgdAdapter: BankAdapter = {
  id: 'cgd',

  matches(rows) {
    return findCgdHeader(rows) !== null;
  },

  parse(rows): ParseResult {
    const h = findCgdHeader(rows);
    if (!h) throw new IngestError('unknown_format', 'CGD: cabeçalho não encontrado');
    const out: ParsedTransaction[] = [];
    let lastDate = '';
    let endingBalance: number | undefined;
    for (const row of rows.slice(h.index + 1)) {
      const date = parseStatementDate(row[h.iDate] ?? '');
      if (!date) continue; // rodapé / linhas de saldo
      const debit = parseEuroAmount(row[h.iDebit] ?? '');
      const credit = parseEuroAmount(row[h.iCredit] ?? '');
      const description = (row[h.iDesc] ?? '').trim();
      if (!Number.isNaN(debit) && debit !== 0) {
        out.push({ date, description, amount: Math.abs(debit), type: 'expense' });
      } else if (!Number.isNaN(credit) && credit !== 0) {
        out.push({ date, description, amount: Math.abs(credit), type: 'income' });
      } else {
        continue;
      }
      if (h.iBalance >= 0 && date >= lastDate) {
        const bal = parseEuroAmount(row[h.iBalance] ?? '');
        if (!Number.isNaN(bal)) {
          lastDate = date;
          endingBalance = bal;
        }
      }
    }
    if (out.length === 0) throw new IngestError('no_valid_rows', 'CGD: sem movimentos válidos');
    return endingBalance !== undefined ? { txs: out, endingBalance } : { txs: out };
  },
};
