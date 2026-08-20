import { prettyMerchant, type CategoryKey } from '@optifi/core';

/**
 * Regras de categorização do utilizador: "tudo o que aparece como X é da
 * categoria Y". A chave é o nome VISÍVEL do comerciante, não o descritivo cru
 * do banco — o mesmo café chega como "01 COMPRAS C.DEB SABORES 1776944666" e
 * "09 COMPRAS C.DEB SABORES 1781092435", e só o nome apresentado colapsa os
 * dois. Assim a regra que o utilizador cria corresponde exatamente ao que ele
 * viu no ecrã quando a criou.
 */
export const CATEGORY_KEYS: CategoryKey[] = [
  'habitacao',
  'alimentacao',
  'transporte',
  'lazer',
  'subscricoes',
  'saude',
  'educacao',
  'transferencias',
  'receita',
  'outros',
];

export function isCategoryKey(v: unknown): v is CategoryKey {
  return typeof v === 'string' && (CATEGORY_KEYS as string[]).includes(v);
}

/** Chave de regra de um descritivo de extrato. */
export function merchantKey(description: string): string {
  return prettyMerchant(description);
}

export type RuleMap = Map<string, CategoryKey>;

export function toRuleMap(rows: { merchant: string; category: string }[] | null): RuleMap {
  const map: RuleMap = new Map();
  for (const r of rows ?? []) {
    if (isCategoryKey(r.category)) map.set(r.merchant, r.category);
  }
  return map;
}

/**
 * Sobrepõe as regras do utilizador ao veredicto do categorizador automático.
 * O automático corre sempre primeiro e decide tudo o que não tem regra; a
 * regra só entra por cima, e por isso melhorias no motor continuam a chegar
 * aos movimentos que o utilizador nunca corrigiu.
 */
export function applyCategoryRules<T extends { description: string; category: CategoryKey }>(
  txs: T[],
  rules: RuleMap,
): T[] {
  if (rules.size === 0) return txs;
  return txs.map((tx) => {
    const rule = rules.get(merchantKey(tx.description));
    return rule && rule !== tx.category ? { ...tx, category: rule } : tx;
  });
}
