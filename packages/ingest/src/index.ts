import { parseCsv } from './csv.js';
import { decodeStatementText } from './text.js';
import { revolutAdapter } from './adapters/revolut.js';
import { cgdAdapter } from './adapters/cgd.js';
import { bcpAdapter } from './adapters/bcp.js';
import { parseWithMapping } from './adapters/generic.js';
import { autoParse } from './adapters/auto.js';
import { buildStatement } from './statement.js';
import type { BankAdapter, BankId, ColumnMapping, StatementSummary } from './types.js';
import { IngestError } from './types.js';

export * from './types.js';
export { parseCsv, sniffDelimiter } from './csv.js';
export { decodeStatementText } from './text.js';
export { parseEuroAmount, parseStatementDate, normalizeDescription } from './values.js';
export { assignFingerprints } from './fingerprint.js';
export { buildStatement, categorizeStatement } from './statement.js';
export { parseWithMapping } from './adapters/generic.js';
export { autoParse } from './adapters/auto.js';
export { parsePdfStatementLines, pdfContentStart } from './pdf.js';
export { revolutAdapter } from './adapters/revolut.js';
export { cgdAdapter } from './adapters/cgd.js';
export { bcpAdapter } from './adapters/bcp.js';

export const ADAPTERS: BankAdapter[] = [revolutAdapter, cgdAdapter, bcpAdapter];

/** Deteta o banco a partir do conteúdo (não confia no que o utilizador escolheu). */
export function detectBank(rows: string[][]): BankId | null {
  for (const adapter of ADAPTERS) {
    if (adapter.matches(rows)) return adapter.id;
  }
  return null;
}

export interface IngestResult {
  bank: BankId | 'outro';
  summary: StatementSummary;
}

/**
 * Pipeline completo: bytes → texto → CSV → adaptador (detetado ou mapeado)
 * → movimentos normalizados → resumo do mês fechado.
 * `bankHint` desempata quando o utilizador escolheu o banco no wizard;
 * `mapping` é obrigatório quando o formato não é reconhecido.
 */
export function ingestStatement(
  bytes: Uint8Array,
  opts: { bankHint?: BankId; mapping?: ColumnMapping } = {},
): IngestResult {
  if (bytes.length === 0) throw new IngestError('empty_file', 'Ficheiro vazio');
  const text = decodeStatementText(bytes);
  const rows = parseCsv(text);
  if (rows.length === 0) throw new IngestError('no_rows', 'Ficheiro sem linhas');

  if (opts.mapping) {
    return { bank: 'outro', summary: buildStatement(parseWithMapping(rows, opts.mapping)) };
  }

  const hinted = opts.bankHint ? ADAPTERS.find((a) => a.id === opts.bankHint) : undefined;
  if (hinted?.matches(rows)) {
    const r = hinted.parse(rows);
    return { bank: hinted.id, summary: buildStatement(r.txs, r.endingBalance) };
  }
  for (const adapter of ADAPTERS) {
    if (adapter.matches(rows)) {
      const r = adapter.parse(rows);
      return { bank: adapter.id, summary: buildStatement(r.txs, r.endingBalance) };
    }
  }
  // Sem adaptador específico: o detetor universal lê qualquer banco/corretora
  // (Santander, Millennium, Trading 212, Trade Republic…) inferindo as colunas
  // pelo conteúdo. Só se ELE falhar caímos no mapeamento manual de colunas.
  try {
    const r = autoParse(rows);
    return { bank: 'outro', summary: buildStatement(r.txs, r.endingBalance) };
  } catch {
    throw new IngestError('unknown_format', 'Formato não reconhecido — usa o mapeamento de colunas');
  }
}
