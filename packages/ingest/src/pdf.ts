import type { ParsedTransaction, ParseResult } from './types.js';
import { IngestError } from './types.js';
import { parseEuroAmount, parseStatementDate } from './values.js';

/**
 * Parser de extratos em PDF — trabalha sobre as LINHAS de texto reconstruídas
 * (a extração com coordenadas vive na app; isto é puro e testável). Modelo real
 * dos extratos portugueses, validado com Millennium BCP e Santander:
 *   [data(s)]  descritivo  [VALOR  SALDO]
 * ou seja, cada movimento COMEÇA com uma ou duas datas e TERMINA com dois
 * números: o penúltimo é o valor, o último é o saldo. (Tomar o primeiro número
 * era o bug: as descrições trazem montantes embutidos — "COMISSAO ... 199.92
 * APP MB WAY 0.40 694.92" tem 199.92 no texto e 0.40 é o valor real.)
 *
 * Datas: completas (YYYY-MM-DD, DD-MM-YYYY) ou PARCIAIS sem ano — "01-06"
 * (dia-mês, separador '-'/'/') e "6.01" (mês-dia, separador '.') — o ano vem do
 * período do extrato. Sinal: montante assinado (Santander) ou variação do saldo
 * (Millennium, sem sinal). Sem qualquer pista → recusa ('pdf_unreadable').
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;
const close = (a: number, b: number): boolean => Math.abs(a - b) < 0.02;

/**
 * Offset do marcador '%PDF' nos primeiros bytes, ou -1 se não for PDF. Alguns
 * ficheiros trazem lixo à frente (BOM, ou um cabeçalho de serialização Java
 * quando o PDF foi guardado embrulhado — visto num extrato real do Santander),
 * por isso não basta olhar para o byte 0.
 */
export function pdfContentStart(bytes: Uint8Array): number {
  const limit = Math.min(bytes.length - 4, 2048);
  for (let i = 0; i <= limit; i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) return i;
  }
  return -1;
}

/**
 * Um montante: opcionalmente assinado, com milhares por espaço/ponto/vírgula e
 * decimal por '.'/','. O lookbehind impede colar a um número/letra/código
 * anterior (ex.: cartão "*1321 161,06" → 161,06, não 1321161,06).
 */
const MONEY = /(?<![\dA-Za-z*.,€])[-+−]?€?\s?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+[.,]\d{2}|\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+[.,]\d{2})(?!\d)/g;

/** Data completa no início da linha. */
const FULL_DATE = /^\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/;
/** Data parcial (sem ano): '01-06', '6.01', '01/06'. */
const PARTIAL_DATE = /^\s*(\d{1,2})([-/.])(\d{1,2})(?!\d)/;
/** Uma data parcial em qualquer ponto da linha (rodapé colado ao movimento). */
const PARTIAL_ANYWHERE = /(\d{1,2})([-/.])(\d{1,2})(?!\d)/g;

/** Linhas que não são movimentos mas dão a âncora do saldo de abertura. */
const OPENING_RE = /saldo\s+(inicial|anterior)/i;

/**
 * Fim dos movimentos da conta: o que vem depois (juros de descoberto,
 * "Facilidade/Ultrapassagem de Crédito", decomposições) NÃO são movimentos.
 */
const STOP_RE = /facilidade\s+(de\s+)?descoberto|ultrapassagem\s+de\s+cr[eé]dito|descritivo de movimentos de facilidade/i;
/** Linhas com taxa em % (juros) nunca são um movimento normal. */
const RATE_RE = /\d\s*%/;

interface RawRow {
  date: string;
  description: string;
  amount: number; // absoluto
  signed: number; // valor com sinal, para detetar modo assinado
  balance: number | null;
  type: 'expense' | 'income' | null;
}

/** Ano e conjunto de meses cobertos pelo período do extrato. */
function detectPeriod(lines: string[]): { year: number; months: Set<number> } {
  const months = new Set<number>();
  const years = new Map<number, number>();
  const re = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/g;
  for (const line of lines) {
    for (const m of line.matchAll(re)) {
      const y = m[1] ? +m[1] : +m[6]!;
      const mo = m[1] ? +m[2]! : +m[5]!;
      if (y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12) {
        years.set(y, (years.get(y) ?? 0) + 1);
        months.add(mo);
      }
    }
  }
  const year = [...years.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? new Date().getFullYear();
  if (months.size === 0) for (let i = 1; i <= 12; i++) months.add(i);
  return { year, months };
}

/** Compõe 'YYYY-MM-DD' a partir de dia/mês parciais e do ano do período. */
function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Interpreta um par parcial: '.' → mês-dia; '-'/'/' → dia-mês. Corrige se inválido. */
function partialToDate(a: number, b: number, sep: string, year: number): string | null {
  let month: number;
  let day: number;
  if (sep === '.') { month = a; day = b; } else { day = a; month = b; }
  if (month > 12 && day <= 12) { const t = month; month = day; day = t; }
  return ymd(year, month, day);
}

/** Deteta a(s) data(s) no início (ou coladas a um rodapé) e devolve onde acaba. */
function findDate(line: string, year: number, months: Set<number>): { date: string; end: number } | null {
  // Data completa no início.
  const full = line.match(FULL_DATE);
  if (full) {
    const d = parseStatementDate(full[1]!.trim());
    if (d) return { date: d, end: consumeSecond(line, full[0].length, year) };
  }
  // Data parcial no início.
  const part = line.match(PARTIAL_DATE);
  if (part) {
    const d = partialToDate(+part[1]!, +part[3]!, part[2]!, year);
    if (d) return { date: d, end: consumeSecond(line, part[0].length, year) };
  }
  // Data parcial no meio (rodapé colado ao movimento) — a primeira cujo mês é
  // do período e que tenha dinheiro depois.
  for (const m of line.matchAll(PARTIAL_ANYWHERE)) {
    const d = partialToDate(+m[1]!, +m[3]!, m[2]!, year);
    if (!d) continue;
    const mo = +d.slice(5, 7);
    if (!months.has(mo)) continue;
    const end = consumeSecond(line, m.index! + m[0].length, year);
    if (MONEY.test(line.slice(end))) { MONEY.lastIndex = 0; return { date: d, end }; }
    MONEY.lastIndex = 0;
  }
  return null;
}

/** Consome uma SEGUNDA data parcial/completa logo a seguir (Data Lanç. + Data Valor). */
function consumeSecond(line: string, from: number, year: number): number {
  const rest = line.slice(from);
  const p = rest.match(/^\s+(\d{1,2})([-/.])(\d{1,2})(?!\d)/);
  if (p && partialToDate(+p[1]!, +p[3]!, p[2]!, year)) return from + p[0].length;
  const f = rest.match(/^\s+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/);
  if (f) return from + f[0].length;
  return from;
}

function cleanDescription(s: string): string {
  return s.replace(/€/g, ' ').replace(/\s+/g, ' ').replace(/^[\s·|:_-]+|[\s·|:_-]+$/g, '').trim().slice(0, 80).trim();
}

export function parsePdfStatementLines(lines: string[]): ParseResult {
  const { year, months } = detectPeriod(lines);
  const rows: RawRow[] = [];
  let opening: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    if (STOP_RE.test(line)) break; // secção de juros/descoberto: acabaram os movimentos
    if (RATE_RE.test(line)) continue; // linha de taxa (juros), não é movimento

    if (OPENING_RE.test(line)) {
      const monies = [...line.matchAll(MONEY)].map((m) => parseEuroAmount(m[0]));
      const last = monies.filter((n) => !Number.isNaN(n)).pop();
      if (last !== undefined) opening = round2(last);
      continue;
    }

    const dm = findDate(line, year, months);
    if (!dm) continue;
    const rest = line.slice(dm.end);
    const monies = [...rest.matchAll(MONEY)];
    if (monies.length === 0) continue;

    // Penúltimo = valor; último = saldo (se houver dois).
    const amtTok = monies.length >= 2 ? monies[monies.length - 2]! : monies[monies.length - 1]!;
    const balTok = monies.length >= 2 ? monies[monies.length - 1]! : null;
    const signed = parseEuroAmount(amtTok[0]);
    if (Number.isNaN(signed) || signed === 0) continue;
    const balance = balTok ? parseEuroAmount(balTok[0]) : NaN;

    rows.push({
      date: dm.date,
      description: cleanDescription(rest.slice(0, amtTok.index)) || 'Movimento',
      amount: round2(Math.abs(signed)),
      signed,
      balance: Number.isNaN(balance) ? null : round2(balance),
      type: null,
    });
  }

  if (rows.length === 0) throw new IngestError('pdf_unreadable', 'PDF: sem movimentos reconhecíveis');

  // Modo assinado (Santander): há montantes negativos → positivo = entrada.
  // Senão (Millennium): resolve tudo pela variação do saldo (ordem do ficheiro).
  const signedMode = rows.some((r) => r.signed < 0);
  if (signedMode) {
    for (const r of rows) r.type = r.signed < 0 ? 'expense' : 'income';
  } else {
    let prev = opening;
    for (const r of rows) {
      if (r.balance != null && prev != null && close(Math.abs(r.balance - prev), r.amount)) {
        r.type = r.balance - prev < 0 ? 'expense' : 'income';
      }
      if (r.balance != null) prev = r.balance;
    }
  }

  const unresolved = rows.filter((r) => r.type === null);
  if (unresolved.length === rows.length) {
    throw new IngestError('pdf_unreadable', 'PDF: impossível distinguir entradas de saídas');
  }
  if (unresolved.length > 0) {
    const exp = rows.filter((r) => r.type === 'expense').length;
    const inc = rows.filter((r) => r.type === 'income').length;
    for (const r of unresolved) r.type = exp >= inc ? 'expense' : 'income';
  }

  const txs: ParsedTransaction[] = rows.map((r) => ({ date: r.date, description: r.description, amount: r.amount, type: r.type! }));

  const withBal = rows.filter((r) => r.balance != null);
  const endingBalance = withBal.length ? round2(withBal.reduce((a, b) => (b.date >= a.date ? b : a)).balance!) : undefined;
  return endingBalance !== undefined ? { txs, endingBalance } : { txs };
}
