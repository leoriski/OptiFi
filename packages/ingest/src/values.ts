/**
 * Normalização de valores e datas nos formatos usados pelos bancos
 * portugueses. Tudo baseado em strings — nunca objetos Date (fusos horários
 * são a fonte clássica de movimentos que mudam de dia).
 */

/**
 * Converte um montante em texto para número EUR.
 * Aceita: '12,99' · '1.234,56' · '1 234,56' · '-12.99' · '1,234.56' ·
 * '€ 12,99' · '(12,99)' (negativo contabilístico). Devolve NaN se não for número.
 */
export function parseEuroAmount(raw: string): number {
  // O sinal menos tipográfico (U+2212) aparece em PDFs — normaliza para ASCII.
  let s = (raw ?? '').replace(/−/g, '-').trim();
  if (s === '') return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Símbolos de moeda e todos os espaços (inclui NBSP/espaço fino dos milhares).
  s = s.replace(/[€$£¥]/g, '').replace(/\s/g, '');
  // Código de moeda colado ao valor (EUR/USD/…), à frente ou atrás.
  s = s.replace(/^[A-Za-z]+|[A-Za-z]+$/g, '');
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // Formato PT: '.' milhares, ',' decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Formato EN: ',' milhares, '.' decimal
    s = s.replace(/,/g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const value = parseFloat(s);
  return negative ? -value : value;
}

/**
 * Converte uma data de extrato para ISO 'YYYY-MM-DD'.
 * Aceita: 'YYYY-MM-DD' (com hora opcional), 'DD-MM-YYYY', 'DD/MM/YYYY',
 * 'DD.MM.YYYY'. Bancos PT são sempre dia-primeiro. Devolve null se inválida.
 */
export function parseStatementDate(raw: string): string | null {
  const s = (raw ?? '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})([ T].*)?$/);
  if (m) {
    const [, y, mo, d] = m;
    return isValidYmd(+y!, +mo!, +d!) ? `${y}-${mo}-${d}` : null;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const d = +m[1]!;
    const mo = +m[2]!;
    const y = +m[3]!;
    return isValidYmd(y, mo, d) ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  }
  return null;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1]!;
}

/** Normaliza um descritivo para comparação/fingerprint. */
export function normalizeDescription(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}
