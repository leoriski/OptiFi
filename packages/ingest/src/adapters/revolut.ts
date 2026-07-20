import type { BankAdapter, ParsedTransaction, ParseResult } from '../types.js';
import { IngestError } from '../types.js';
import { parseEuroAmount, parseStatementDate } from '../values.js';

/**
 * Revolut — CSV UTF-8, vírgula, cabeçalho na primeira linha. A app exporta
 * com os cabeçalhos NO IDIOMA DA APP: em inglês
 * (Type,Product,Started Date,Completed Date,Description,Amount,Fee,…,State,Balance)
 * ou em português (Tipo,Produto,Data de início,Data de conclusão,Descrição,
 * Montante,Taxa,…,Estado,Saldo) — reconhecemos ambos. Amount é assinado
 * (negativo = despesa). Só contam movimentos COMPLETED/CONCLUÍDO; a Fee é
 * somada à despesa (é dinheiro que saiu).
 */

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/** Nomes equivalentes de cada coluna (EN e PT, normalizados sem acentos). */
const COLS = {
  started: ['started date', 'data de inicio'],
  completed: ['completed date', 'data de conclusao'],
  description: ['description', 'descricao'],
  amount: ['amount', 'montante'],
  fee: ['fee', 'taxa'],
  state: ['state', 'estado'],
  balance: ['balance', 'saldo'],
};

const COMPLETED_STATES = new Set(['completed', 'concluido', 'concluida']);

function findCol(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(h));
}

export const revolutAdapter: BankAdapter = {
  id: 'revolut',

  matches(rows) {
    const header = rows[0]?.map(norm) ?? [];
    return (
      findCol(header, COLS.started) >= 0 &&
      findCol(header, COLS.description) >= 0 &&
      findCol(header, COLS.amount) >= 0 &&
      findCol(header, COLS.state) >= 0
    );
  },

  parse(rows): ParseResult {
    const header = rows[0]!.map(norm);
    const iCompleted = findCol(header, COLS.completed);
    const iStarted = findCol(header, COLS.started);
    const iDesc = findCol(header, COLS.description);
    const iAmount = findCol(header, COLS.amount);
    const iFee = findCol(header, COLS.fee);
    const iState = findCol(header, COLS.state);
    const iBalance = findCol(header, COLS.balance);

    const out: ParsedTransaction[] = [];
    let lastDate = '';
    let endingBalance: number | undefined;
    for (const row of rows.slice(1)) {
      const state = norm(row[iState] ?? '');
      if (!COMPLETED_STATES.has(state)) continue;
      const date = parseStatementDate(row[iCompleted] ?? '') ?? parseStatementDate(row[iStarted] ?? '');
      const amount = parseEuroAmount(row[iAmount] ?? '');
      const fee = iFee >= 0 ? parseEuroAmount(row[iFee] ?? '') : NaN;
      if (!date || Number.isNaN(amount) || amount === 0) continue;
      const net = amount - (Number.isNaN(fee) ? 0 : Math.abs(fee));
      out.push({
        date,
        description: (row[iDesc] ?? '').trim(),
        amount: Math.abs(net),
        type: net < 0 ? 'expense' : 'income',
      });
      // Saldo final = coluna Balance do movimento mais recente
      if (iBalance >= 0 && date >= lastDate) {
        const bal = parseEuroAmount(row[iBalance] ?? '');
        if (!Number.isNaN(bal)) {
          lastDate = date;
          endingBalance = bal;
        }
      }
    }
    if (out.length === 0) throw new IngestError('no_valid_rows', 'Revolut: sem movimentos válidos');
    return endingBalance !== undefined ? { txs: out, endingBalance } : { txs: out };
  },
};
