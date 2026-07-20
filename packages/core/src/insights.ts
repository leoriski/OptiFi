// Motor de insights inteligentes — a resposta determinística ao "agente IA":
// todas as sugestões saem de regras explícitas sobre os dados reais, com
// valores concretos em euros. Zero custos de API, 100% testável, e nunca
// inventa nada que os números não mostrem.

import type { CategorySpend, Goal, GoalProjection, Subscription } from './types.js';
import type { Analysis, Insight } from './analyze.js';
import { activeSubsTotal } from './subscriptions.js';
import { monthsBetween } from './goals.js';
import { projection } from './fv.js';
import { matchCatalog, prettyMerchant } from './catalog.js';

/** Movimento mínimo necessário para deteção de padrões. */
export interface TxLite {
  date: string; // 'YYYY-MM-DD'
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}

export interface SmartContext {
  income: number;
  expenses: number;
  categorySpend: CategorySpend[];
  subs: Subscription[];
  transactions: TxLite[];
  goals: Goal[];
  goalProjections: Record<string, GoalProjection>;
  /** Análise base (fugas por teto) — evita recalcular e duplicar. */
  analysis: Analysis;
  today: Date;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Limiar de "compra pequena" e nº mínimo para virar padrão. */
const SMALL_PURCHASE_EUR = 7.5;
const SMALL_PURCHASE_MIN_COUNT = 8;
/** Peso da habitação no rendimento acima do qual alertamos (regra 35%). */
const HOUSING_ALERT_SHARE = 0.35;
/** Projeção de investimento anexada a cada poupança (taxa exemplo, conservadora). */
/**
 * Anexa a projeção de investimento (10/15/20 anos) a um insight, com base num
 * valor mensal reduzível. A UI mostra sempre "investe X/mês → A/B/C".
 */
function attachProjection(ins: Insight, monthly: number): Insight {
  if (monthly <= 0) return ins;
  const p = projection(monthly);
  return { ...ins, params: { ...ins.params, monthly: round2(monthly), rate: p.rate, fv10: p.fv10, fv15: p.fv15, fv20: p.fv20 } };
}

/** Projeção nas poupanças de subscrição (valor mensal = a poupança). */
function withProjection(ins: Insight): Insight {
  if (ins.kind !== 'savings' || ins.saving <= 0) return ins;
  return attachProjection(ins, ins.saving);
}

/** Folga mensal mínima para valer a pena falar de capacidade de investimento. */
const INVEST_CAPACITY_MIN = 20;

/** Folga mensal real: rendimento − despesas − o que já está alocado às metas. */
function monthlyCapacity(ctx: SmartContext): number {
  const surplus = ctx.income - ctx.expenses;
  const allocated = ctx.goals.reduce((a, g) => a + (g.monthlyAllocation || 0), 0);
  return round2(surplus - allocated);
}

/** Poupança anual mínima para sugerir renegociar dois serviços. */
const RENEG_MIN_ANNUAL = 24;
/** Reforço mensal mínimo (vindo da fuga) para acelerar uma meta. */
const GOAL_ACCEL_MIN_EXTRA = 10;

export function generateSmartInsights(ctx: SmartContext): Insight[] {
  const out: Insight[] = [];
  out.push(...investmentCapacity(ctx));
  out.push(...renegotiateServices(ctx));
  out.push(...goalAcceleration(ctx));
  out.push(...subscriptionSavings(ctx));
  out.push(...spendingPatterns(ctx));
  out.push(...spendingObservations(ctx));
  out.push(...structuralAlerts(ctx));
  out.push(...goalCoaching(ctx));
  out.push(...longTermFraming(ctx));
  // Poupanças concretas primeiro (maiores no topo), depois alertas, resto no fim.
  const kindOrder = { savings: 0, leak: 1, alert: 2, achievement: 3 } as const;
  return out.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || b.saving - a.saving);
}

/**
 * 0a. Capacidade de investimento: a folga mensal REAL (rendimento − despesas −
 * o que já está alocado às metas). Não é conselho — mostra só quanto sobra sem
 * mexer nos objetivos; a projeção anexada mostra o que renderia. Tudo ligado:
 * se as despesas ou as metas mudarem, este número muda com elas.
 */
function investmentCapacity(ctx: SmartContext): Insight[] {
  if (ctx.income <= 0) return [];
  const capacity = monthlyCapacity(ctx);
  if (capacity < INVEST_CAPACITY_MIN) return [];
  return [attachProjection({ id: 'invest_capacity', kind: 'savings', saving: 0, params: { amount: capacity } }, capacity)];
}

/** Serviços do catálogo com plano mais barato/partilha — margem para renegociar. */
function renegotiableCandidates(ctx: SmartContext): { name: string; saving: number }[] {
  const cands: { name: string; saving: number }[] = [];
  for (const sub of ctx.subs) {
    if (sub.userStatus === 'cancelled') continue;
    const entry = matchCatalog(sub.name);
    if (!entry) continue;
    let saving = 0;
    if (entry.cheaperPlan) saving = Math.max(saving, round2(sub.price - entry.cheaperPlan.price));
    if (entry.share) saving = Math.max(saving, round2(sub.price - entry.share.perPerson));
    if (saving >= 1) cands.push({ name: prettyMerchant(sub.name), saving });
  }
  return cands.sort((a, b) => b.saving - a.saving);
}

/**
 * 0b. Oportunidade anual: junta os DOIS serviços com mais margem e mostra
 * quanto se poupa num ano ao renegociá-los. As sugestões por serviço continuam
 * em baixo (o "como"); esta é a manchete anual (o "quanto").
 */
function renegotiateServices(ctx: SmartContext): Insight[] {
  const cands = renegotiableCandidates(ctx);
  if (cands.length < 2) return [];
  const [a, b] = cands;
  const monthly = round2(a.saving + b.saving);
  const annual = round2(monthly * 12);
  if (annual < RENEG_MIN_ANNUAL) return [];
  return [attachProjection({ id: 'renegotiate_two', kind: 'savings', saving: 0, params: { annual, a: a.name, b: b.name } }, monthly)];
}

/**
 * 0c. Aceleração de meta: liga a FOLGA mensal (capacidade de investimento) a um
 * objetivo — se redirecionares essa folga para a meta, quantos meses ganhas.
 * Escolhe a meta onde o ganho é maior. Só dispara com ganho real (≥ 2 meses).
 */
function goalAcceleration(ctx: SmartContext): Insight[] {
  const extra = monthlyCapacity(ctx);
  if (extra < GOAL_ACCEL_MIN_EXTRA) return [];
  let best: { name: string; months: number } | undefined;
  for (const g of ctx.goals) {
    const p = ctx.goalProjections[g.id];
    if (!p || p.state !== 'allocated' || !p.months || p.alloc <= 0) continue;
    const newMonths = Math.ceil(p.remaining / (p.alloc + extra));
    const earlier = p.months - newMonths;
    if (earlier >= 2 && (!best || earlier > best.months)) best = { name: g.name ?? '', months: earlier };
  }
  if (!best) return [];
  return [{ id: 'goal_accelerate', kind: 'alert', saving: 0, params: { name: best.name, extra, months: best.months } }];
}

/**
 * 1. Análise de subscrições SEM FALHAS: toda a subscrição ativa recebe
 * exatamente uma análise, por esta ordem de prioridade:
 *  a) marcada "não vale" (rejected) → cancela e recupera (com projeção);
 *  b) no catálogo com opção de poupança → a melhor opção honesta;
 *  c) tudo o resto (desconhecidas, ou catálogo sem opção) → custo anualizado.
 * Preferência dentro do catálogo: manter o MESMO serviço e, entre opções, a
 * que a pessoa executa SOZINHA (plano mais barato > partilha > grátis).
 */
function subscriptionSavings(ctx: SmartContext): Insight[] {
  const out: Insight[] = [];
  for (const sub of ctx.subs) {
    if (sub.userStatus === 'cancelled') continue;
    const annual = round2(sub.price * 12);

    // a) O utilizador já disse que não vale — a análise é direta: cancelar.
    if (sub.userStatus === 'rejected') {
      out.push(
        withProjection({
          id: `sub_cut_${sub.id}`,
          kind: 'savings',
          saving: round2(sub.price),
          params: { name: prettyMerchant(sub.name), saving: round2(sub.price), annual },
        }),
      );
      continue;
    }

    // b) Catálogo: melhor opção honesta.
    const entry = matchCatalog(sub.name);
    if (entry) {
      let best: { option: 'cheaper' | 'share'; optName: string; newPrice: number; saving: number } | undefined;
      if (entry.cheaperPlan && round2(sub.price - entry.cheaperPlan.price) >= 1) {
        best = {
          option: 'cheaper',
          optName: entry.cheaperPlan.name,
          newPrice: entry.cheaperPlan.price,
          saving: round2(sub.price - entry.cheaperPlan.price),
        };
      } else if (entry.share && round2(sub.price - entry.share.perPerson) >= 1) {
        best = {
          option: 'share',
          optName: '',
          newPrice: entry.share.perPerson,
          saving: round2(sub.price - entry.share.perPerson),
        };
      }
      if (best) {
        out.push(
          withProjection({
            id: `sub_save_${entry.key}`,
            kind: 'savings',
            saving: best.saving,
            params: { name: prettyMerchant(sub.name), option: best.option, optName: best.optName, newPrice: best.newPrice, saving: best.saving },
          }),
        );
        continue;
      }
      if (entry.freeAlt) {
        out.push(
          withProjection({
            id: `sub_free_${entry.key}`,
            kind: 'savings',
            saving: round2(sub.price),
            params: { name: prettyMerchant(sub.name), optName: entry.freeAlt.name, sameService: entry.freeAlt.sameService ? 1 : 0, saving: round2(sub.price) },
          }),
        );
        continue;
      }
    }

    // c) Fallback universal: nunca deixar uma subscrição sem análise. Mesmo
    //    sem opção no catálogo, mostra o custo anual + o que renderia investido.
    out.push(
      attachProjection(
        {
          id: `sub_annual_${sub.id}`,
          kind: 'alert',
          saving: 0,
          params: { name: prettyMerchant(sub.name), price: round2(sub.price), annual },
        },
        round2(sub.price),
      ),
    );
  }
  return out;
}

// (Os duplicados do mesmo tipo de serviço vivem agora em generateAnalysis —
//  são FUGA, entram no money leak/plano, não são só uma sugestão solta.)

/** 3. Padrões nos movimentos: compras pequenas, comerciante dominante, maior despesa. */
function spendingPatterns(ctx: SmartContext): Insight[] {
  const out: Insight[] = [];
  // Transferências para pessoas NÃO são consumo — ficam de fora dos padrões de
  // gasto (senão a "maior despesa" seria um MB WAY a um amigo). Coerente com a
  // categoria própria de transferências.
  const expenses = ctx.transactions.filter((t) => t.type === 'expense' && t.category !== 'transferencias');
  if (expenses.length === 0) return out;

  const small = expenses.filter((t) => t.amount <= SMALL_PURCHASE_EUR);
  if (small.length >= SMALL_PURCHASE_MIN_COUNT) {
    const total = round2(small.reduce((a, b) => a + b.amount, 0));
    out.push(
      attachProjection(
        { id: 'small_purchases', kind: 'alert', saving: 0, params: { count: small.length, total } },
        round2(total / 2),
      ),
    );
  }

  const byMerchant = new Map<string, { name: string; count: number; total: number }>();
  for (const t of expenses) {
    const key = norm(t.description);
    const m = byMerchant.get(key) ?? { name: t.description, count: 0, total: 0 };
    m.count++;
    m.total += t.amount;
    byMerchant.set(key, m);
  }
  const top = [...byMerchant.values()].sort((a, b) => b.count - a.count)[0];
  if (top && top.count >= 4) {
    out.push(
      attachProjection(
        { id: 'top_merchant', kind: 'alert', saving: 0, params: { name: prettyMerchant(top.name), count: top.count, total: round2(top.total) } },
        round2(top.total / 2),
      ),
    );
  }

  const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0]!;
  if (ctx.expenses > 0 && biggest.amount / ctx.expenses >= 0.15 && biggest.category !== 'habitacao') {
    out.push({
      id: 'biggest_expense',
      kind: 'alert',
      saving: 0,
      params: { desc: prettyMerchant(biggest.description), amount: round2(biggest.amount), pct: Math.round((biggest.amount / ctx.expenses) * 100) },
    });
  }
  return out;
}

/** Nº de dias do mês de uma data 'YYYY-MM-DD'. */
function daysInMonthOf(dateStr: string): number {
  const [y, m] = dateStr.split('-').map(Number);
  if (!y || !m) return 0;
  return new Date(y, m, 0).getDate();
}

/**
 * 3b. Observações do mês — ângulos DIFERENTES sobre os mesmos movimentos, para
 * a análise não ser sempre a mesma: ritmo diário, peso do fim de semana e a
 * categoria que mais pesa. São informativas (neutras), disparam só quando o
 * padrão é notável e evitam pisar alertas já existentes (habitação, maior
 * despesa individual).
 */
function spendingObservations(ctx: SmartContext): Insight[] {
  const out: Insight[] = [];
  // Consumo real = despesas SEM transferências para pessoas (não são gasto).
  const exp = ctx.transactions.filter((t) => t.type === 'expense' && t.category !== 'transferencias');
  const consumption = round2(exp.reduce((a, b) => a + b.amount, 0));
  if (exp.length < 6 || consumption <= 0) return out;

  // Ritmo diário: consumo / dias do mês analisado.
  const days = daysInMonthOf(exp[0].date);
  if (days > 0) {
    const perDay = round2(consumption / days);
    if (perDay > 0) out.push({ id: 'daily_avg', kind: 'alert', saving: 0, params: { amount: perDay, days } });
  }

  // Peso do fim de semana (sáb/dom) — só quando é notável.
  let weekend = 0;
  for (const t of exp) {
    const [y, m, d] = t.date.split('-').map(Number);
    if (!y || !m || !d) continue;
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) weekend += t.amount;
  }
  const pct = Math.round((weekend / consumption) * 100);
  if (pct >= 35) out.push({ id: 'weekend_spend', kind: 'alert', saving: 0, params: { pct, amount: round2(weekend) } });

  // Categoria dominante (exceto habitação e transferências, que não são gasto
  // reduzível ou têm alerta próprio).
  const top = [...ctx.categorySpend]
    .filter((c) => c.categoryId !== 'receita' && c.categoryId !== 'habitacao' && c.categoryId !== 'transferencias')
    .sort((a, b) => b.amount - a.amount)[0];
  if (top && top.amount > 0) {
    const catPct = Math.round((top.amount / consumption) * 100);
    if (catPct >= 30) out.push({ id: 'cat_concentration', kind: 'alert', saving: 0, params: { cat: top.categoryId, pct: catPct, amount: round2(top.amount) } });
  }

  return out;
}

/** 4. Estrutura: peso da habitação e distância aos 20% de poupança. */
function structuralAlerts(ctx: SmartContext): Insight[] {
  const out: Insight[] = [];
  if (ctx.income <= 0) return out;

  const housing = ctx.categorySpend.find((c) => c.categoryId === 'habitacao')?.amount ?? 0;
  const share = housing / ctx.income;
  if (share > HOUSING_ALERT_SHARE) {
    out.push({
      id: 'housing_share',
      kind: 'alert',
      saving: 0,
      params: { pct: Math.round(share * 100), amount: round2(housing) },
    });
  }

  const rate = (ctx.income - ctx.expenses) / ctx.income;
  if (rate < 0.2 && rate >= 0) {
    const gap = round2(0.2 * ctx.income - (ctx.income - ctx.expenses));
    out.push({
      id: 'rate_gap',
      kind: 'alert',
      saving: 0,
      params: { pct: Math.round(rate * 100), gap },
    });
  }
  return out;
}

/** 5. Metas: dinheiro parado por alocar e reforço necessário para cumprir prazos. */
function goalCoaching(ctx: SmartContext): Insight[] {
  const out: Insight[] = [];
  for (const g of ctx.goals) {
    const p = ctx.goalProjections[g.id];
    if (!p || p.state !== 'allocated' || p.onTrack || !p.deadline) continue;
    const monthsLeft = monthsBetween(ctx.today, p.deadline);
    if (monthsLeft <= 0) continue;
    const needed = round2(Math.ceil(p.remaining / monthsLeft) - p.alloc);
    if (needed <= 0) continue;
    out.push({
      id: `goal_boost_${g.id}`,
      kind: 'alert',
      saving: 0,
      params: { name: g.name ?? '', needed, monthsLate: p.monthsLate ?? 0 },
    });
  }
  return out;
}

// (Removido o "coaching de score": a app não expõe um score financeiro, por
//  isso as sugestões deixaram de falar em pontos. As ações úteis que sugeria —
//  rever subscrições pendentes e resolver a maior fuga — já aparecem noutros
//  insights, sem duplicar.)

/** 7. Enquadramento de longo prazo: o que a fuga vale em 10 anos. */
function longTermFraming(ctx: SmartContext): Insight[] {
  const activeLeak = ctx.analysis.baseLeak;
  if (activeLeak < 20) return [];
  const proj = projection(activeLeak);
  return [
    {
      id: 'leak_fv',
      kind: 'achievement',
      saving: 0,
      params: { monthly: activeLeak, rate: proj.rate, fv10: proj.fv10, fv15: proj.fv15, fv20: proj.fv20 },
    },
  ];
}
