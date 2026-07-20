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

/** 'YYYY-MM' → 'Junho 2026' (capitalizado, como o protótipo). */
export const monthLabel = (ym: string, lang: 'pt' | 'en'): string => {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** 'YYYY-MM' → 'Jun' (rótulo curto para o gráfico). */
export const monthShort = (ym: string, lang: 'pt' | 'en'): string => {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', { month: 'short' });
  const clean = s.replace('.', '');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

/** Substitui {chaves} num template traduzido. */
export const fill = (template: string, params: Record<string, string | number>): string =>
  Object.entries(params).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template);
