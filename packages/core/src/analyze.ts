// Geração de análise a partir do mês importado — a substituição honesta dos
// números fixos do protótipo (baseLeak €219, insights hardcoded). Tudo aqui é
// derivado dos movimentos reais por regras explícitas e testáveis. Sem dados
// de utilização de apps não afirmamos "não usas há N dias" — só o que os
// números mostram.

import type { CategorySpend, PlanItem, Subscription } from './types.js';
import { activeSubsTotal, countByStatus } from './subscriptions.js';
import { projection } from './fv.js';
import { inferKind, prettyMerchant, type ServiceKind } from './catalog.js';

/**
 * Tetos recomendados por categoria, como fração do rendimento do mês.
 * Gastar acima disto gera um item de fuga com a poupança correspondente.
 * habitacao/saude/receita nunca geram fugas; subscricoes têm pilar próprio.
 */
export const CATEGORY_CAPS: Record<string, number> = {
  alimentacao: 0.2,
  lazer: 0.06,
  transporte: 0.12,
  outros: 0.08,
};

/** Poupança mínima para valer a pena sugerir (evita itens de €1). */
const MIN_SAVING_EUR = 5;

/**
 * Fuga por FREQUÊNCIA: categorias discricionárias com muitos pagamentos
 * repetidos no mesmo mês são um sinal de gasto reduzível, mesmo abaixo do teto.
 * Nº mínimo de movimentos para disparar, por categoria.
 */
const FREQUENCY_MIN: Record<string, number> = {
  transporte: 4, // boleias (Uber/Bolt/Lime) somam depressa
  lazer: 3,
  alimentacao: 6, // refeições/compras frequentes fora
  outros: 6,
};
/** Fração da categoria assumida como reduzível quando há gasto repetido. */
const FREQUENCY_CUT = 0.3;

/** Rácio de subscrições/rendimento acima do qual alertamos. */
const SUBS_ALERT_RATIO = 0.06;

export interface LeakPlanItem extends PlanItem {
  /**
   * category_cap = gasto acima do teto; subscription = subscrição "não vale";
   * sub_duplicate = 2+ serviços do mesmo tipo em simultâneo (manter o mais barato).
   */
  kind: 'category_cap' | 'subscription' | 'sub_duplicate';
  category: string;
  spend: number;
  capEur: number;
  /** Nome do serviço (subscription) ou dos serviços a cortar (sub_duplicate). */
  name?: string;
  /** Só para sub_duplicate: o serviço mais barato, a manter. */
  keepName?: string;
  keepPrice?: number;
  /** Só para sub_duplicate: tipo de serviço e nº de subscrições no grupo. */
  dupKind?: ServiceKind;
  /** Nº de movimentos (sub_duplicate = subs no grupo; category_cap = compras no mês). */
  count?: number;
  /** category_cap: a fuga veio do teto ('cap') ou da frequência de compras ('frequency'). */
  reason?: 'cap' | 'frequency';
  /** O que esta poupança vale investida a INVEST_RATE aos 10/15/20 anos. */
  fv10: number;
  fv15: number;
  fv20: number;
}

export type InsightKind = 'leak' | 'alert' | 'savings' | 'achievement';

export interface Insight {
  id: string;
  kind: InsightKind;
  /** Poupança mensal associada (0 para conquistas/alertas informativos). */
  saving: number;
  /** Parâmetros para a UI construir o texto traduzido. */
  params: Record<string, string | number>;
  /** Item do plano a que corresponde (dois espelhos da mesma despesa). */
  planItemId?: string;
}

export interface Analysis {
  planItems: LeakPlanItem[];
  /** Fuga total do mês = soma dos itens gerados. */
  baseLeak: number;
  insights: Insight[];
}

export interface AnalysisInput {
  income: number;
  expenses: number;
  categorySpend: CategorySpend[];
  subs: Subscription[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Nome base de um serviço para deduplicação: sem acentos, sem prefixos de
 * terminal/POS ("compra", "estrang", códigos e cartões "*5297", números
 * soltos à cabeça). "02 FITNESS UP GROUP" e "18 FITNESS UP GROUP" → o mesmo.
 */
function baseServiceName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(compra|estrang|pagamento|pag|mb way|trf)\b/g, ' ')
    .replace(/[*#]\d+/g, ' ')
    .replace(/^[\s\d.*#/-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateAnalysis(input: AnalysisInput): Analysis {
  const { income, expenses, categorySpend, subs } = input;
  const planItems: LeakPlanItem[] = [];
  const insights: Insight[] = [];

  // 1. Fugas por categoria: gasto acima do teto recomendado.
  if (income > 0) {
    for (const row of categorySpend) {
      const capShare = CATEGORY_CAPS[row.categoryId];
      if (capShare === undefined) continue;
      const capEur = round2(income * capShare);
      // Sinal 1: gasto acima do teto recomendado.
      const capOver = round2(row.amount - capEur);
      // Sinal 2: muitos pagamentos repetidos na mesma categoria (frequência).
      const count = row.count ?? 0;
      const freqMin = FREQUENCY_MIN[row.categoryId];
      const freqReducible = freqMin !== undefined && count >= freqMin ? round2(row.amount * FREQUENCY_CUT) : 0;
      // A fuga da categoria é o maior dos dois (um único item, sem duplicar).
      const saving = Math.max(capOver, freqReducible);
      if (saving < MIN_SAVING_EUR) continue;
      const reason: 'cap' | 'frequency' = capOver >= freqReducible ? 'cap' : 'frequency';
      const id = `cap_${row.categoryId}`;
      const proj = projection(saving);
      planItems.push({
        id,
        kind: 'category_cap',
        category: row.categoryId,
        spend: row.amount,
        capEur,
        monthlySaving: saving,
        count,
        reason,
        fv10: proj.fv10,
        fv15: proj.fv15,
        fv20: proj.fv20,
      });
      insights.push({
        id: `ins_${id}`,
        kind: 'leak',
        saving,
        planItemId: id,
        params: { category: row.categoryId, spend: row.amount, cap: capEur, saving, monthly: saving, rate: proj.rate, fv10: proj.fv10, fv15: proj.fv15, fv20: proj.fv20, n: count, reason },
      });
    }
  }

  // 1b. Subscrições marcadas "não vale" (rejected) = desperdício confirmado.
  //     Entram no money leak como itens resolvíveis (cancelar → poupança=preço).
  for (const sub of subs) {
    if (sub.userStatus !== 'rejected') continue;
    const saving = round2(sub.price);
    if (saving < 1) continue;
    const id = `subleak_${sub.id}`;
    const proj = projection(saving);
    planItems.push({
      id,
      kind: 'subscription',
      category: 'subscricoes',
      name: prettyMerchant(sub.name),
      spend: sub.price,
      capEur: 0,
      monthlySaving: saving,
      fv10: proj.fv10,
      fv15: proj.fv15,
      fv20: proj.fv20,
    });
    insights.push({
      id: `ins_${id}`,
      kind: 'leak',
      saving,
      planItemId: id,
      params: { name: prettyMerchant(sub.name), saving, annual: round2(sub.price * 12), monthly: saving, rate: proj.rate, fv10: proj.fv10, fv15: proj.fv15, fv20: proj.fv20 },
    });
  }

  // 1c. Duplicados do mesmo TIPO de serviço (televisão, música, VPN, …) =
  //     fuga estrutural: pagar 2+ serviços equivalentes em simultâneo.
  //     Mantém-se o mais barato e corta-se o resto. As "rejected" ficam de
  //     fora do grupo (já contam individualmente em 1b — sem dupla contagem).
  //     Cobre catálogo E nomes desconhecidos (inferKind por palavras-chave).
  const byKind = new Map<ServiceKind, Subscription[]>();
  for (const sub of subs) {
    if (sub.userStatus === 'cancelled' || sub.userStatus === 'rejected') continue;
    const kind = inferKind(sub.name);
    if (!kind) continue;
    const list = byKind.get(kind) ?? [];
    list.push(sub);
    byKind.set(kind, list);
  }
  for (const [kind, raw] of byKind) {
    // O MESMO serviço cobrado 2× no mês (ex.: ginásio inscrição + mensalidade,
    // "02 FITNESS UP" e "18 FITNESS UP") não são 2 serviços diferentes — junta
    // pelo nome base (sem códigos de terminal) e fica o mais barato de cada um.
    const distinct = new Map<string, Subscription>();
    for (const s of raw) {
      const base = baseServiceName(s.name);
      const ex = distinct.get(base);
      if (!ex || s.price < ex.price) distinct.set(base, s);
    }
    const group = [...distinct.values()];
    if (group.length < 2) continue;
    const total = round2(group.reduce((a, b) => a + b.price, 0));
    const cheapest = group.reduce((a, b) => (b.price < a.price ? b : a));
    const saving = round2(total - cheapest.price);
    if (saving < 3) continue;
    const id = `subdup_${kind}`;
    const proj = projection(saving);
    const others = group.filter((s) => s !== cheapest).map((s) => prettyMerchant(s.name)).join(' + ');
    planItems.push({
      id,
      kind: 'sub_duplicate',
      category: 'subscricoes',
      name: others,
      keepName: prettyMerchant(cheapest.name),
      keepPrice: round2(cheapest.price),
      dupKind: kind,
      count: group.length,
      spend: total,
      capEur: round2(cheapest.price),
      monthlySaving: saving,
      fv10: proj.fv10,
      fv15: proj.fv15,
      fv20: proj.fv20,
    });
    insights.push({
      id: `ins_${id}`,
      kind: 'leak',
      saving,
      planItemId: id,
      params: { count: group.length, kindKey: kind, total, keepName: prettyMerchant(cheapest.name), keepPrice: round2(cheapest.price), saving, monthly: saving, rate: proj.rate, fv10: proj.fv10, fv15: proj.fv15, fv20: proj.fv20 },
    });
  }

  // Itens maiores primeiro — a UI mostra o topo.
  planItems.sort((a, b) => b.monthlySaving - a.monthlySaving);

  const baseLeak = round2(planItems.reduce((a, b) => a + b.monthlySaving, 0));

  // 2. Alertas de subscrições (sem inventar dados de utilização).
  const subsTotal = activeSubsTotal(subs);
  const unknown = countByStatus(subs, 'unknown');
  if (unknown > 0) {
    insights.push({
      id: 'ins_subs_review',
      kind: 'alert',
      saving: 0,
      params: { count: unknown, total: round2(subsTotal) },
    });
  }
  if (income > 0 && subsTotal / income > SUBS_ALERT_RATIO) {
    insights.push({
      id: 'ins_subs_ratio',
      kind: 'alert',
      saving: 0,
      params: { total: round2(subsTotal), pct: Math.round((subsTotal / income) * 100) },
    });
  }

  // 3. Conquista: taxa de poupança do mês acima dos 20% recomendados.
  if (income > 0) {
    const rate = (income - expenses) / income;
    if (rate >= 0.2) {
      insights.push({
        id: 'ins_rate_achievement',
        kind: 'achievement',
        saving: 0,
        params: { pct: Math.round(rate * 100), net: round2(income - expenses) },
      });
    }
  }

  return { planItems, baseLeak, insights };
}
