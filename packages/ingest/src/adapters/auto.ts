import type { ParsedTransaction, ParseResult } from '../types.js';
import { IngestError } from '../types.js';
import { parseEuroAmount, parseStatementDate } from '../values.js';

/**
 * Detetor UNIVERSAL de extratos — o fallback que faz a app ler qualquer banco
 * ou corretora sem o utilizador mapear nada. Não depende dos nomes das colunas
 * (que mudam por banco e idioma): infere pelo CONTEÚDO qual é a coluna de data,
 * descritivo e valor(es), e resolve o sinal (entrada/saída) por três vias, pela
 * ordem mais fiável:
 *   1. montante já assinado (−12,34);
 *   2. colunas separadas de débito/crédito;
 *   3. variação do saldo entre movimentos (o saldo desce → saída);
 *   4. coluna de "ação" (Depósito/Levantamento/Compra… — corretoras T212/etc.).
 * Sem nenhuma pista de sentido, recusa em vez de adivinhar.
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;
const close = (a: number, b: number): boolean => Math.abs(a - b) < 0.02;

function norm(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/** Palavras que marcam a coluna de débito/crédito (para saber o sentido). */
const DEBIT_WORDS = ['debito', 'debit', 'saida', 'levantamento', 'a debito', 'pagamento'];
const CREDIT_WORDS = ['credito', 'credit', 'entrada', 'deposito', 'a credito', 'recebido'];

/** Vocabulário de "ação" das corretoras/apps (Trading 212, Trade Republic…). */
const INCOME_ACTIONS = ['deposit', 'deposito', 'dividend', 'dividendo', 'interest', 'juros', 'sell', 'venda', 'sale', 'received', 'recebido', 'cashback', 'reward', 'refund', 'reembolso'];
const EXPENSE_ACTIONS = ['withdraw', 'levantamento', 'buy', 'compra', 'purchase', 'fee', 'comissao', 'taxa', 'card', 'cartao', 'payment', 'pagamento', 'sent', 'enviado', 'transfer out'];

interface Cell {
  raw: string;
  date: string | null;
  money: number | null;
}

interface Row {
  cells: Cell[];
  dateCol: number;
}

/** Uma célula é "dinheiro" só se tiver casas decimais — evita apanhar quantidades/IDs inteiros. */
function asMoney(raw: string): number | null {
  const s = (raw ?? '').trim();
  if (s === '' || !/\d[.,]\d{2}(?!\d)/.test(s)) return null;
  const v = parseEuroAmount(s);
  return Number.isNaN(v) ? null : v;
}

export function autoParse(rows: string[][]): ParseResult {
  // 1. Classifica cada célula (data? dinheiro?) e guarda as linhas de movimento
  //    (as que têm pelo menos uma data e um valor). Preâmbulo/rodapé caem fora.
  const parsed: Row[] = [];
  for (const cells of rows) {
    const classified: Cell[] = cells.map((raw) => ({ raw, date: parseStatementDate(raw), money: asMoney(raw) }));
    const dateCol = classified.findIndex((c) => c.date !== null);
    if (dateCol < 0) continue;
    if (!classified.some((c) => c.money !== null)) continue;
    parsed.push({ cells: classified, dateCol });
  }
  if (parsed.length === 0) throw new IngestError('no_valid_rows', 'Sem movimentos reconhecíveis no ficheiro');

  // 2. Coluna de data dominante (o mesmo índice na maioria das linhas).
  const dateCol = mode(parsed.map((r) => r.dateCol));
  const txRows = parsed.filter((r) => r.cells[dateCol]?.date != null);
  if (txRows.length === 0) throw new IngestError('no_valid_rows', 'Datas inconsistentes no ficheiro');

  const nCols = Math.max(...txRows.map((r) => r.cells.length));

  // 3. Quantas linhas têm dinheiro em cada coluna.
  const moneyFill: number[] = [];
  for (let c = 0; c < nCols; c++) {
    moneyFill[c] = txRows.filter((r) => r.cells[c]?.money != null).length;
  }
  const headerCells = guessHeader(rows, dateCol);

  // 4a. SALDO primeiro (coluna quase sempre preenchida cuja variação entre
  //     movimentos consecutivos = o valor do movimento). Detetá-lo à parte
  //     evita confundi-lo com o valor no caso débito/crédito.
  const fullCols = range(nCols).filter((c) => c !== dateCol && moneyFill[c]! >= txRows.length * 0.8);
  const balanceCol = detectBalance(txRows, fullCols);

  // 4b. Colunas de movimento = as que têm valor com alguma frequência, exceto
  //     a data e o saldo.
  const moveCols = range(nCols).filter((c) => c !== dateCol && c !== balanceCol && moneyFill[c]! >= Math.max(1, txRows.length * 0.15));

  let amountCol = -1;
  let debitCol = -1;
  let creditCol = -1;

  if (moveCols.length === 1) {
    amountCol = moveCols[0]!;
  } else if (moveCols.length >= 2) {
    // Ordena por quão preenchidas estão. Débito/crédito têm preenchimento
    // SEMELHANTE e são mutuamente exclusivos. Se uma coluna domina (a outra é
    // esparsa — ex.: "Preço/ação", "Comissão"), a cheia é o valor.
    const byFill = moveCols.slice().sort((a, b) => moneyFill[b]! - moneyFill[a]!);
    const top = byFill[0]!;
    const second = byFill[1]!;
    const comparable = moneyFill[second]! >= moneyFill[top]! * 0.6;
    const bothFilled = txRows.filter((r) => r.cells[top]?.money != null && r.cells[second]?.money != null).length;
    const exclusive = bothFilled < txRows.length * 0.3;
    if (comparable && exclusive) {
      const [c1, c2] = orderDebitCredit([top, second], headerCells);
      debitCol = c1;
      creditCol = c2;
    } else {
      amountCol = top;
    }
  }

  if (amountCol < 0 && debitCol < 0) throw new IngestError('no_valid_rows', 'Não encontrámos a coluna de valor');

  // 5. Coluna de descritivo = a coluna de texto (não-data, não-dinheiro) mais
  //    longa em média. Junta as restantes se ajudar.
  const usedCols = new Set([dateCol, amountCol, balanceCol, debitCol, creditCol].filter((c) => c >= 0));
  const descCol = pickDescriptionCol(txRows, usedCols, nCols);
  const actionCol = pickActionCol(txRows, nCols, usedCols);

  // 6. Constrói os movimentos.
  const built: { row: Row; date: string; description: string; amount: number; type: 'income' | 'expense' | null; balance: number | null }[] = [];
  for (const r of txRows) {
    const date = r.cells[dateCol]!.date!;
    const description = buildDescription(r, descCol, actionCol, nCols, usedCols);
    const balance = balanceCol >= 0 ? r.cells[balanceCol]?.money ?? null : null;

    let amount: number;
    let type: 'income' | 'expense' | null = null;
    if (debitCol >= 0) {
      const d = r.cells[debitCol]?.money ?? 0;
      const cr = r.cells[creditCol]?.money ?? 0;
      if (d !== 0) { amount = Math.abs(d); type = 'expense'; }
      else if (cr !== 0) { amount = Math.abs(cr); type = 'income'; }
      else continue;
    } else {
      const v = r.cells[amountCol]?.money;
      if (v == null || v === 0) continue;
      amount = Math.abs(v);
      if (v < 0) type = 'expense';
      else if (hasNegatives(txRows, amountCol)) type = 'income'; // coluna assinada, este é positivo
      // senão fica null → resolve por saldo/ação abaixo
    }
    built.push({ row: r, date, description, amount: round2(amount), type, balance });
  }
  if (built.length === 0) throw new IngestError('no_valid_rows', 'Sem movimentos válidos após a análise');

  // 7. Resolve sinais em falta pela variação do saldo (ordem cronológica).
  if (built.some((b) => b.type === null) && balanceCol >= 0) {
    const chrono = [...built].filter((b) => b.balance != null).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (let i = 0; i < chrono.length; i++) {
      const cur = chrono[i]!;
      if (cur.type !== null || i === 0) continue;
      const delta = cur.balance! - chrono[i - 1]!.balance!;
      if (close(Math.abs(delta), cur.amount)) cur.type = delta < 0 ? 'expense' : 'income';
    }
  }
  // 8. Resolve o que faltar pela coluna de ação (corretoras).
  if (built.some((b) => b.type === null) && actionCol >= 0) {
    for (const b of built) {
      if (b.type !== null) continue;
      const a = norm(b.row.cells[actionCol]?.raw ?? '');
      if (EXPENSE_ACTIONS.some((w) => a.includes(w))) b.type = 'expense';
      else if (INCOME_ACTIONS.some((w) => a.includes(w))) b.type = 'income';
    }
  }

  const unresolved = built.filter((b) => b.type === null);
  if (unresolved.length > 0) {
    // Sem QUALQUER pista de sentido: recusa honesta (melhor que inventar).
    if (unresolved.length === built.length) {
      throw new IngestError('no_valid_rows', 'Não foi possível distinguir entradas de saídas neste ficheiro');
    }
    // Minoria por resolver num ficheiro coerente → assume o sentido dominante.
    const expenses = built.filter((b) => b.type === 'expense').length;
    const income = built.filter((b) => b.type === 'income').length;
    for (const b of unresolved) b.type = expenses >= income ? 'expense' : 'income';
  }

  const txs: ParsedTransaction[] = built.map((b) => ({ date: b.date, description: b.description || 'Movimento', amount: b.amount, type: b.type! }));

  // Saldo final = saldo do movimento com data mais recente.
  let endingBalance: number | undefined;
  if (balanceCol >= 0) {
    const withBal = built.filter((b) => b.balance != null);
    if (withBal.length) endingBalance = round2(withBal.reduce((a, b) => (b.date >= a.date ? b : a)).balance!);
  }
  return endingBalance !== undefined ? { txs, endingBalance } : { txs };
}

// ── auxiliares ──────────────────────────────────────────────────────────────

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function mode(nums: number[]): number {
  const counts = new Map<number, number>();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

function hasNegatives(rows: Row[], col: number): boolean {
  return rows.some((r) => (r.cells[col]?.money ?? 0) < 0);
}

/** Maior valor de dinheiro numa linha, excluindo uma coluna (o candidato a saldo). */
function largestOther(row: Row, exclude: number): number {
  let max = 0;
  row.cells.forEach((c, i) => {
    if (i === exclude || c.money == null) return;
    const abs = Math.abs(c.money);
    if (abs > max) max = abs;
  });
  return max;
}

/**
 * Saldo = a coluna (das que estão quase sempre cheias) cuja variação entre
 * movimentos consecutivos coincide com o valor do movimento. Serve tanto para
 * montante assinado como para débito/crédito. -1 se nenhuma se qualificar.
 */
function detectBalance(rows: Row[], fullCols: number[]): number {
  let best = -1;
  let bestScore = 0;
  for (const b of fullCols) {
    const seq = rows.filter((r) => r.cells[b]?.money != null);
    if (seq.length < 3) continue;
    let matches = 0;
    let tested = 0;
    for (let i = 1; i < seq.length; i++) {
      const other = largestOther(seq[i]!, b);
      if (other === 0) continue;
      tested++;
      const delta = Math.abs(seq[i]!.cells[b]!.money! - seq[i - 1]!.cells[b]!.money!);
      if (close(delta, other)) matches++;
    }
    const score = tested >= 2 ? matches / tested : 0;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return bestScore >= 0.6 ? best : -1;
}

/** Ordena duas colunas como [débito, crédito] usando o cabeçalho, senão a ordem. */
function orderDebitCredit(cols: number[], header: Record<number, string>): [number, number] {
  const a = cols[0]!;
  const b = cols[1]!;
  const ha = header[a] ?? '';
  const hb = header[b] ?? '';
  const aIsCredit = CREDIT_WORDS.some((w) => ha.includes(w));
  const bIsDebit = DEBIT_WORDS.some((w) => hb.includes(w));
  const aIsDebit = DEBIT_WORDS.some((w) => ha.includes(w));
  const bIsCredit = CREDIT_WORDS.some((w) => hb.includes(w));
  if (aIsCredit || bIsDebit) return [b, a];
  if (aIsDebit || bIsCredit) return [a, b];
  return [a, b]; // convenção PT: débito à esquerda, crédito à direita
}

/** Cabeçalho normalizado (índice → texto) da linha logo antes dos dados. */
function guessHeader(rows: string[][], dateCol: number): Record<number, string> {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = rows[i]!;
    const isDataRow = parseStatementDate(cells[dateCol] ?? '') !== null;
    if (isDataRow) {
      const prev = rows[i - 1];
      if (prev) return Object.fromEntries(prev.map((c, idx) => [idx, norm(c)]));
      return {};
    }
  }
  return {};
}

/** Uma célula "com palavras" (tem espaço ou minúsculas) e não é um código ISIN/IBAN. */
function isWordy(raw: string): boolean {
  if (raw === '' || /^[A-Z0-9]{10,}$/.test(raw)) return false;
  return /\s/.test(raw) || /[a-zà-ÿ]/.test(raw);
}

/** Descritivo = a coluna com mais texto "com palavras" (ignora códigos e moeda). */
function pickDescriptionCol(rows: Row[], used: Set<number>, nCols: number): number {
  let best = -1;
  let bestScore = 0;
  for (let c = 0; c < nCols; c++) {
    if (used.has(c)) continue;
    let wordy = 0;
    let total = 0;
    for (const r of rows) {
      const cell = r.cells[c];
      if (!cell || cell.money != null || cell.date != null) continue;
      const raw = cell.raw.trim();
      if (!isWordy(raw)) continue;
      wordy++;
      total += raw.length;
    }
    // Prioriza colunas onde a maioria das linhas tem palavras; desempata pelo comprimento.
    const score = wordy * 1000 + (wordy ? total / wordy : 0);
    if (wordy > 0 && score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/** Coluna de "ação" (Depósito/Compra/…): texto curto de um vocabulário conhecido. */
function pickActionCol(rows: Row[], nCols: number, used: Set<number>): number {
  let best = -1;
  let bestHits = 0;
  for (let c = 0; c < nCols; c++) {
    if (used.has(c)) continue;
    let hits = 0;
    for (const r of rows) {
      const v = norm(r.cells[c]?.raw ?? '');
      if (v === '') continue;
      if (INCOME_ACTIONS.some((w) => v.includes(w)) || EXPENSE_ACTIONS.some((w) => v.includes(w))) hits++;
    }
    if (hits > bestHits) { bestHits = hits; best = c; }
  }
  return bestHits >= rows.length * 0.5 ? best : -1;
}

function buildDescription(r: Row, descCol: number, actionCol: number, nCols: number, used: Set<number>): string {
  if (descCol >= 0) {
    const d = (r.cells[descCol]?.raw ?? '').trim();
    if (d !== '') return d.slice(0, 80);
  }
  // Sem coluna clara: junta o texto das colunas livres (ação + nome).
  const parts: string[] = [];
  for (let c = 0; c < nCols; c++) {
    if (used.has(c) || c === descCol) continue;
    const raw = (r.cells[c]?.raw ?? '').trim();
    if (raw !== '' && r.cells[c]?.money == null && r.cells[c]?.date == null) parts.push(raw);
  }
  return parts.join(' · ').slice(0, 80) || (actionCol >= 0 ? (r.cells[actionCol]?.raw ?? '').trim() : '');
}
