// Formatadores partilhados pelas duas apps (web e mobile). Todas as apps têm
// de dizer os mesmos números da mesma maneira — ter o formato escrito em dois
// sítios seria um bug à espera de acontecer. Os nomes dos meses são escritos à
// mão de propósito: o `toLocaleDateString('pt-PT')` depende do Intl, e no
// Hermes (mobile) os dados de locale podem não vir no bundle — dava "June" no
// meio de uma app em português, ou pior, silêncio.

import type { Lang } from './dict.js';

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

/** 'YYYY-MM' → 'Junho 2026' ('2026' vem sempre, o mês é que muda de ano). */
const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MESES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM' → 'Junho 2026' (ou 'June 2026'). */
export const monthLabel = (ym: string, lang: Lang = 'pt'): string => {
  const [y, m] = ym.split('-').map(Number);
  const nome = (lang === 'pt' ? MESES_PT : MESES_EN)[(m ?? 1) - 1];
  return nome ? `${nome} ${y}` : ym;
};

const MESES_CURTOS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_CURTOS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM' → 'jun' (eixo do gráfico, onde não cabe o nome inteiro). */
export const monthShort = (ym: string, lang: Lang = 'pt'): string => {
  const [, m] = ym.split('-').map(Number);
  return (lang === 'pt' ? MESES_CURTOS_PT : MESES_CURTOS_EN)[(m ?? 1) - 1] ?? ym;
};

/** 'YYYY-MM-DD' → '14 JUN' (cabeçalho de dia na lista de movimentos). */
export const dayShort = (iso: string): string => {
  const [, m, d] = iso.split('-').map(Number);
  const mes = MESES_CURTOS_PT[(m ?? 1) - 1];
  return mes ? `${d} ${mes.toUpperCase()}` : iso;
};

/** 'YYYY-MM-DDTHH:mm' (ISO com hora) → '14 jun' (data do saldo de abertura). */
export const dayShortFromIso = (iso: string): string => {
  const day = iso.slice(0, 10);
  const [, m, d] = day.split('-').map(Number);
  const mes = MESES_CURTOS_PT[(m ?? 1) - 1];
  return mes ? `${d} ${mes}` : day;
};

/** Substitui {chaves} num template. */
export const fill = (template: string, params: Record<string, string | number>): string =>
  Object.entries(params).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template);