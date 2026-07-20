import type { CategoryKey } from '@optifi/core';

/** Movimento normalizado — o formato único para onde todos os bancos convergem. */
export interface ParsedTransaction {
  /** Data ISO 'YYYY-MM-DD' (sempre tratada como string — nunca objetos Date, para evitar fusos). */
  date: string;
  description: string;
  /** Valor positivo em EUR; o sentido vem de `type`. */
  amount: number;
  type: 'income' | 'expense';
}

export interface CategorizedTransaction extends ParsedTransaction {
  category: CategoryKey;
  /** Impressão digital estável para deduplicação em reimportações. */
  fingerprint: string;
}

export type BankId = 'revolut' | 'cgd' | 'bcp';

export interface ParseResult {
  txs: ParsedTransaction[];
  /** Saldo final da conta no fim do período, quando o extrato o traz. */
  endingBalance?: number;
}

export interface BankAdapter {
  id: BankId;
  /** Reconhece o formato a partir das linhas parseadas do CSV. */
  matches(rows: string[][]): boolean;
  /** Converte as linhas no formato normalizado. Lança IngestError se o ficheiro for inválido. */
  parse(rows: string[][]): ParseResult;
}

/** Mapeamento manual de colunas — o fallback universal para bancos desconhecidos. */
export interface ColumnMapping {
  /** Índice (0-based) da linha de cabeçalho; as linhas seguintes são dados. */
  headerRow: number;
  dateCol: number;
  descriptionCol: number;
  /** Ou uma coluna única com sinal… */
  amountCol?: number;
  /** …ou duas colunas débito/crédito. */
  debitCol?: number;
  creditCol?: number;
}

export interface StatementSummary {
  /** Mês fechado analisado, 'YYYY-MM' (o mês dominante do ficheiro). */
  statementMonth: string;
  /** Saldo final do banco no fim do período, se o extrato o trouxer. */
  endingBalance?: number;
  transactions: CategorizedTransaction[];
  income: number;
  expenses: number;
  /** Compromisso fixo de habitação (renda + utilities) detetado no mês. */
  housingFixed: number;
  /** Subscrições detetadas (despesas recorrentes da categoria subscricoes). */
  subscriptions: { name: string; price: number }[];
}

export class IngestError extends Error {
  constructor(
    public code:
      | 'empty_file'
      | 'no_rows'
      | 'unknown_format'
      | 'bad_mapping'
      | 'no_valid_rows'
      | 'pdf_unreadable',
    message: string,
  ) {
    super(message);
    this.name = 'IngestError';
  }
}
