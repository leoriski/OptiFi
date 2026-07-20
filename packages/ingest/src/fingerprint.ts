import type { ParsedTransaction } from './types.js';
import { normalizeDescription } from './values.js';

/**
 * Impressão digital estável de um movimento para deduplicação em
 * reimportações: data + valor em cêntimos + descritivo normalizado +
 * índice de ocorrência (dois cafés iguais no mesmo dia são dois movimentos,
 * não um duplicado). Legível de propósito — depurável em produção.
 */
export function assignFingerprints(txs: ParsedTransaction[]): (ParsedTransaction & { fingerprint: string })[] {
  const seen = new Map<string, number>();
  return txs.map((tx) => {
    const cents = Math.round(tx.amount * 100);
    const sign = tx.type === 'expense' ? '-' : '+';
    const base = `${tx.date}|${sign}${cents}|${normalizeDescription(tx.description)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...tx, fingerprint: `${base}|${n}` };
  });
}
