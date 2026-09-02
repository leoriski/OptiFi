/**
 * O sistema visual da app, portado do `globals.css` da web.
 *
 * No browser isto eram variáveis CSS que cascateavam sozinhas a partir de
 * `[data-mode]` / `[data-accent]` no `<html>`. O React Native não tem cascata
 * nem variáveis: cada componente recebe as cores por argumento. Por isso o que
 * lá era um seletor é aqui uma função — mas os valores são os mesmos, e as
 * decisões que estavam comentadas no CSS continuam explicadas aqui.
 */

export type Mode = 'light' | 'dark';
export type Accent = 'emerald' | 'brand' | 'amber' | 'violet';

const MODES = {
  dark: {
    bg: '#0B0E14',
    bg2: '#11151E',
    card: '#161B26',
    card2: '#1D2330',
    b: '#262D3D',
    tx: '#F4F7FB',
    tx2: '#9AA7BD',
    tx3: '#5C6781',
    gr: '#22C55E',
    re: '#F43F5E',
    ye: '#F59E0B',
    // Linha "Sobra" do gráfico: azul fixo, independente do accent. Se seguisse
    // o accent, com o tema emerald ficavam dois verdes ao lado das barras de
    // receitas e não se distinguia um do outro.
    chartNet: '#38BDF8',
  },
  light: {
    bg: '#F7F8FA',
    bg2: '#FFFFFF',
    card: '#FFFFFF',
    card2: '#F2F4F7',
    b: '#E4E8EF',
    // Preto principal menos carregado; secundários mais escuros para
    // legibilidade — a hierarquia vem da cor, não do bold.
    tx: '#1B2433',
    tx2: '#414B5C',
    tx3: '#626C7D',
    gr: '#16A34A',
    re: '#E11D48',
    ye: '#D97706',
    // Sobre branco o #38BDF8 desaparece numa linha fina — desce-se um tom.
    chartNet: '#0EA5E9',
  },
} as const;

// `pr` tem dois valores: o segundo é o usado em modo claro, onde a cor viva
// não chega para texto branco por cima (o #10B981 dá ≈2,5:1 sobre branco).
const ACCENTS: Record<Accent, { pr: string; prLight: string; ac: string }> = {
  emerald: { pr: '#10B981', prLight: '#047857', ac: '#5EEAD4' },
  amber: { pr: '#F59E0B', prLight: '#B45309', ac: '#FFC44D' },
  violet: { pr: '#7C5CFF', prLight: '#6D28D9', ac: '#B794FF' },
  // "Neutro" é monocromático: o accent É a cor do texto.
  brand: { pr: '', prLight: '', ac: '' },
};

export interface Theme {
  mode: Mode;
  bg: string;
  bg2: string;
  card: string;
  card2: string;
  b: string;
  tx: string;
  tx2: string;
  tx3: string;
  gr: string;
  re: string;
  ye: string;
  /** Linha do líquido no gráfico — nunca o accent (ver MODES). */
  chartNet: string;
  pr: string;
  ac: string;
  /** Raio dos cartões (era --r) e dos elementos pequenos (era --rs). */
  r: number;
  rs: number;
}

export function buildTheme(mode: Mode = 'light', accent: Accent = 'emerald'): Theme {
  const m = MODES[mode];
  const a = ACCENTS[accent];
  const pr = accent === 'brand' ? m.tx : mode === 'light' ? a.prLight : a.pr;
  const ac = accent === 'brand' ? m.tx2 : a.ac;
  return { mode, ...m, pr, ac, r: 14, rs: 10 };
}

/** Verde/vermelho só para semântica de dinheiro — nunca para decorar. */
export function moneyColor(n: number, t: Theme): string {
  if (n > 0) return t.gr;
  if (n < 0) return t.re;
  return t.tx;
}
