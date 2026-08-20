import type { ManualEntry, Subscription } from './types.js';
import { prettyMerchant } from './catalog.js';

/** Total monthly cost of subscriptions still being paid (anything not cancelled). */
export function activeSubsTotal(subs: Subscription[]): number {
  return subs
    .filter((s) => s.userStatus !== 'cancelled')
    .reduce((a, b) => a + (b.price || 0), 0);
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Subscrições ativas que ainda NÃO aparecem nas despesas registadas deste mês.
 *
 * Uma subscrição é uma despesa mensal como outra qualquer: se ninguém a
 * registar, o "disponível" conta dinheiro que já tem dono. Mas a app não sabe
 * o DIA em que cada uma é cobrada, e o saldo que o utilizador copia do banco
 * pode já a excluir — descontá-la à força seria contá-la duas vezes. Por isso
 * isto não desconta nada: devolve o valor para a app o mostrar e propor que
 * entre na lista como despesa por pagar, onde a maquinaria do `paid` já sabe
 * o que fazer.
 *
 * Uma subscrição já registada à mão fica de fora — senão contava a dobrar,
 * que é o problema que isto veio resolver.
 */
export function pendingSubs(
  subs: Subscription[],
  entries: ManualEntry[],
  planMonth: string,
): { total: number; items: { name: string; price: number }[] } {
  const noted = entries
    .filter((e) => e && e.month === planMonth && e.type === 'expense' && e.note)
    .map((e) => norm(e.note as string))
    .filter((n) => n !== '');

  const items: { name: string; price: number }[] = [];
  for (const sub of subs) {
    if (sub.userStatus === 'cancelled' || !(sub.price > 0)) continue;
    const name = prettyMerchant(sub.name);
    const key = norm(name);
    // Contém nos dois sentidos: o registo pode dizer "Netflix" e a subscrição
    // chegar do banco como "Netflix.com Amsterdam".
    const already = key !== '' && noted.some((n) => n === key || n.includes(key) || key.includes(n));
    if (!already) items.push({ name, price: sub.price });
  }
  items.sort((a, b) => b.price - a.price);
  const total = Math.round(items.reduce((a, b) => a + b.price, 0) * 100) / 100;
  return { total, items };
}

export function countByStatus(subs: Subscription[], status: Subscription['userStatus']): number {
  return subs.filter((s) => s.userStatus === status).length;
}
