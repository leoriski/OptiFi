import type { DictKey } from './dict.js';
import type { Insight } from './analyze.js';

/**
 * Transforma um `Insight` (que é só um id e números) na frase que o utilizador
 * lê, e no título do cartão.
 *
 * Vive aqui, e não em cada app, porque um insight sem texto não serve para nada:
 * se o motor ganhar um id novo e só a web souber escrevê-lo, o telemóvel mostra
 * um cartão vazio. Ter as duas coisas no mesmo sítio faz com que isso não possa
 * acontecer sem se dar por ela.
 *
 * O que fica de fora é o que muda de plataforma: traduzir (`t`) e escrever
 * dinheiro (`fmtEur`). Entram por argumento.
 */
export interface InsightTextDeps {
  t: (key: DictKey) => string;
  /** Nome traduzido de uma categoria ('alimentacao' → 'Alimentação'). */
  catLabel: (id: string) => string;
  fmtEur: (n: number) => string;
  /** Sem cêntimos, para os valores grandes das projeções. */
  fmtEur0: (n: number) => string;
  fill: (template: string, params: Record<string, string | number>) => string;
  /**
   * O mês do extrato analisado, já escrito ('Junho 2026'). Vários textos
   * nomeiam-no de propósito: dizer "este mês" transformava a sobra de um mês
   * fechado numa promessa mensal.
   */
  statementMonth: string;
}

export function insightText(ins: Insight, d: InsightTextDeps): string {
  const { t, catLabel, fmtEur, fmtEur0, fill, statementMonth } = d;
  const p = ins.params;

  if (ins.kind === 'leak') {
    if (p.reason === 'frequency') {
      return fill(t('ins_leak_freq_text'), {
        n: Number(p.n),
        cat: catLabel(String(p.category)),
        spend: fmtEur(Number(p.spend)),
        saving: fmtEur(Number(p.saving)),
      });
    }
    return fill(t('ins_leak_text'), {
      cat: catLabel(String(p.category)),
      spend: fmtEur(Number(p.spend)),
      cap: fmtEur(Number(p.cap)),
      saving: fmtEur(Number(p.saving)),
    });
  }

  if (ins.id === 'ins_subs_review') return fill(t('ins_subs_review_text'), { count: p.count!, total: fmtEur(Number(p.total)) });
  if (ins.id === 'ins_subs_ratio') return fill(t('ins_subs_ratio_text'), { total: fmtEur(Number(p.total)), pct: p.pct! });
  if (ins.id === 'ins_other_unknown') return fill(t('ins_other_unknown_text'), { count: Number(p.count), amount: fmtEur(Number(p.amount)), pct: p.pct! });
  if (ins.id === 'ins_rate_achievement') return fill(t('ins_ach_rate_text'), { month: statementMonth, pct: p.pct!, net: fmtEur(Number(p.net)) });

  if (ins.id.startsWith('sub_save_')) {
    const key = p.option === 'cheaper' ? 'ins_sub_cheaper' : 'ins_sub_share';
    return fill(t(key as DictKey), { name: p.name!, optName: p.optName!, newPrice: fmtEur(Number(p.newPrice)), saving: fmtEur(Number(p.saving)) });
  }
  if (ins.id.startsWith('sub_free_')) {
    const key = p.sameService === 1 ? 'ins_sub_free_same' : 'ins_sub_free_diff';
    return fill(t(key as DictKey), { name: p.name!, optName: p.optName!, saving: fmtEur(Number(p.saving)) });
  }
  if (ins.id.startsWith('sub_cut_')) return fill(t('ins_sub_cut'), { name: p.name!, saving: fmtEur(Number(p.saving)), annual: fmtEur(Number(p.annual)) });
  if (ins.id.startsWith('sub_annual_')) return fill(t('ins_sub_annual'), { name: p.name!, price: fmtEur(Number(p.price)), annual: fmtEur(Number(p.annual)) });
  if (ins.id.startsWith('sub_dup_')) {
    return fill(t('ins_sub_dup'), {
      count: p.count!,
      kindLabel: t(`kind_${p.kindKey}` as DictKey),
      total: fmtEur(Number(p.total)),
      keepName: p.keepName!,
      keepPrice: fmtEur(Number(p.keepPrice)),
      saving: fmtEur(Number(p.saving)),
    });
  }

  if (ins.id === 'small_purchases') return fill(t('ins_small_purchases'), { month: statementMonth, count: p.count!, total: fmtEur(Number(p.total)) });
  if (ins.id === 'top_merchant') return fill(t('ins_top_merchant'), { month: statementMonth, name: p.name!, count: p.count!, total: fmtEur(Number(p.total)) });
  if (ins.id === 'biggest_expense') return fill(t('ins_biggest_expense'), { desc: p.desc!, amount: fmtEur(Number(p.amount)), pct: p.pct! });
  if (ins.id === 'housing_share') return fill(t('ins_housing_share'), { pct: p.pct!, amount: fmtEur(Number(p.amount)) });
  if (ins.id === 'rate_gap') return fill(t('ins_rate_gap'), { pct: p.pct!, gap: fmtEur(Number(p.gap)) });
  if (ins.id.startsWith('goal_boost_')) return fill(t('ins_goal_boost'), { name: p.name!, monthsLate: p.monthsLate!, needed: fmtEur(Number(p.needed)) });
  if (ins.id === 'leak_fv') return fill(t('ins_leak_fv'), { monthly: fmtEur(Number(p.monthly)), rate: p.rate!, fv10: fmtEur0(Number(p.fv10)), fv15: fmtEur0(Number(p.fv15)), fv20: fmtEur0(Number(p.fv20)) });
  if (ins.id === 'daily_avg') return fill(t('ins_daily_avg'), { month: statementMonth, amount: fmtEur(Number(p.amount)), days: Number(p.days) });
  if (ins.id === 'weekend_spend') return fill(t('ins_weekend_spend'), { pct: Number(p.pct), amount: fmtEur(Number(p.amount)) });
  if (ins.id === 'cat_concentration') return fill(t('ins_cat_concentration'), { cat: catLabel(String(p.cat)), pct: Number(p.pct), amount: fmtEur(Number(p.amount)) });
  if (ins.id === 'month_deficit') return fill(t('ins_month_deficit'), { month: statementMonth, amount: fmtEur(Number(p.amount)) });
  if (ins.id === 'invest_capacity') return fill(t('ins_invest_capacity'), { month: statementMonth, amount: fmtEur(Number(p.amount)) });
  if (ins.id === 'renegotiate_two') return fill(t('ins_renegotiate'), { annual: fmtEur(Number(p.annual)), a: String(p.a), b: String(p.b) });
  if (ins.id === 'goal_accelerate') return fill(t('ins_goal_accelerate'), { month: statementMonth, extra: fmtEur(Number(p.extra)), name: String(p.name), months: Number(p.months) });

  return '';
}

/** Rótulo genérico do tipo, quando o cartão não é sobre nada de concreto. */
export const INSIGHT_KIND_LABEL: Record<string, DictKey> = {
  leak: 'ins_cat_leak',
  alert: 'ins_cat_alert',
  savings: 'ins_cat_savings',
  achievement: 'ins_cat_ach',
};

const TITLE_BY_ID: Record<string, DictKey> = {
  ins_subs_review: 'inst_subs_review',
  ins_subs_ratio: 'inst_subs_ratio',
  ins_other_unknown: 'inst_other_unknown',
  ins_rate_achievement: 'inst_rate_achievement',
  small_purchases: 'inst_small_purchases',
  biggest_expense: 'inst_biggest_expense',
  housing_share: 'inst_housing_share',
  rate_gap: 'inst_rate_gap',
  leak_fv: 'inst_leak_fv',
  daily_avg: 'inst_daily_avg',
  weekend_spend: 'inst_weekend_spend',
  cat_concentration: 'inst_cat_concentration',
  month_deficit: 'inst_month_deficit',
  invest_capacity: 'inst_invest_capacity',
  renegotiate_two: 'inst_renegotiate',
  goal_accelerate: 'inst_goal_accelerate',
};

/**
 * Antes todos os cartões mostravam só o tipo ("Alerta", "Perda"), o que dava
 * quatro cabeçalhos iguais seguidos e obrigava a ler o corpo de cada um para
 * saber qual interessava. Quando o cartão é sobre um serviço concreto, o título
 * é o nome desse serviço — é o que o utilizador reconhece no extrato.
 */
export function insightTitle(
  ins: Insight,
  d: Pick<InsightTextDeps, 't' | 'catLabel'>,
): string {
  const p = ins.params;
  if (ins.kind === 'leak' && p.category) return d.catLabel(String(p.category));
  if (p.name && (ins.id.startsWith('sub_') || ins.id === 'top_merchant')) return String(p.name);
  const byId = TITLE_BY_ID[ins.id];
  if (byId) return d.t(byId);
  if (ins.id.startsWith('sub_dup_')) return d.t('inst_sub_dup');
  if (ins.id.startsWith('goal_boost_')) return d.t('inst_goal_boost');
  return d.t(INSIGHT_KIND_LABEL[ins.kind] ?? 'ins_cat_alert');
}

/**
 * A ordem em que os cartões aparecem. Os estratégicos (visão geral) vêm à
 * frente das poupanças concretas, e `ins_other_unknown` vem à frente de tudo:
 * enquanto uma fatia grande das despesas estiver por identificar, as contas
 * mais abaixo assentam em dados incompletos, e dizê-lo depois de cinco
 * sugestões seria dizê-lo tarde.
 */
const STRATEGIC = ['ins_other_unknown', 'month_deficit', 'invest_capacity', 'renegotiate_two', 'goal_accelerate'];

export function orderInsights(smart: Insight[], analysisInsights: Insight[]): Insight[] {
  const all = [...smart, ...analysisInsights.filter((i) => i.kind !== 'leak')];
  return [
    ...STRATEGIC.map((id) => all.find((i) => i.id === id)).filter((i): i is Insight => !!i),
    ...all.filter((i) => !STRATEGIC.includes(i.id)),
  ];
}
