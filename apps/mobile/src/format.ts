/**
 * Cópia dos formatadores da web (`apps/web/src/lib/format.ts`). São 15 linhas
 * sem dependências, mas ter o mesmo número escrito de duas maneiras nas duas
 * apps seria um bug à espera de acontecer — quando isto assentar, devem subir
 * para o @optifi/core e as duas apps passam a importar de lá.
 */

/** Milhares com '.', para o formato português (1120 → '1.120'). */
const thousandsPt = (intStr: string): string => intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Formato português: €1.120,20 (símbolo à frente, '.' milhares, ',' decimal). */
export const fmtEur = (n: number): string => {
  const sign = n < 0 ? '-' : '';
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return `${sign}€${thousandsPt(int!)},${dec}`;
};

/** Sem casas decimais, para valores grandes de destaque: €219, €2.628. */
export const fmtEur0 = (n: number): string => {
  const sign = n < 0 ? '-' : '';
  return `${sign}€${thousandsPt(Math.round(Math.abs(n)).toString())}`;
};

// Escritos à mão de propósito: o `toLocaleDateString('pt-PT')` da web depende
// do Intl, e no Hermes os dados de locale podem não vir no bundle — dava
// "June" no meio de uma app em português, ou pior, silêncio.
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** 'YYYY-MM' → 'Junho 2026'. */
export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  const nome = MESES[(m ?? 1) - 1];
  return nome ? `${nome} ${y}` : ym;
};

/** Substitui {chaves} num template. */
export const fill = (template: string, params: Record<string, string | number>): string =>
  Object.entries(params).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template);
