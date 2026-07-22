import { monthKey } from './manual.js';

/**
 * Retenção — o extrato é pontual, não uma ligação viva. Estas duas métricas
 * combatem o "importei uma vez e esqueci": um LEMBRETE quando falta importar o
 * último mês fechado, e um STREAK de meses seguidos analisados (gamifica a
 * regularidade da própria importação, não só os gastos).
 */

/** Mês anterior a uma chave 'YYYY-MM' (ex.: '2026-06' → '2026-05'). */
export function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y!, (m! - 1) - 1, 1); // primeiro dia do mês anterior
  return monthKey(d);
}

export interface ImportCadence {
  /** Meses CONSECUTIVOS analisados, a terminar no último importado. */
  streak: number;
  /** Último mês importado ('YYYY-MM'), ou null se ainda não há nenhum. */
  lastImportedMonth: string | null;
  /** O último mês FECHADO (o mês anterior a hoje) — o que "toca" importar. */
  prevMonth: string;
  /** Já há importações, mas o último mês fechado ainda não foi importado. */
  missingPrevMonth: boolean;
}

/**
 * Deriva a cadência de importações a partir dos meses já importados.
 * @param months lista de 'YYYY-MM' (pode vir desordenada/repetida)
 */
export function importCadence(months: string[], today: Date): ImportCadence {
  const set = new Set(months.filter(Boolean));
  const prevMonth = prevMonthKey(monthKey(today));

  if (set.size === 0) {
    // Conta nova: o onboarding trata disto, não o lembrete de retenção.
    return { streak: 0, lastImportedMonth: null, prevMonth, missingPrevMonth: false };
  }

  const last = [...set].sort().at(-1)!;
  let streak = 0;
  let cur = last;
  while (set.has(cur)) {
    streak++;
    cur = prevMonthKey(cur);
  }

  return { streak, lastImportedMonth: last, prevMonth, missingPrevMonth: !set.has(prevMonth) };
}
