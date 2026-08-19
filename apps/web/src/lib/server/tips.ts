// Dicas do dia. Vivem no servidor porque são enviadas por notificação — o
// cartão da Home foi removido. Só em PT: as notificações de metas também são
// enviadas em PT (o servidor não sabe o idioma escolhido no browser).
export const DAILY_TIPS = [
  'Regra dos 24h: antes de qualquer compra acima de €50 espera 24h. Elimina a maior parte das compras por impulso.',
  'Rever as subscrições uma vez por mês evita pagar por serviços esquecidos.',
  'Reservar dinheiro para metas no início do mês torna a poupança automática — o que sobra é que se gasta.',
  'Compras pequenas repetidas pesam mais do que uma compra grande. Soma os cafés do mês e vê.',
  'Um limite por categoria funciona melhor do que um orçamento total: controlas onde dói.',
  'Paga-te primeiro: transfere para as metas no dia em que recebes, não no fim do mês.',
];

// Todos recebem a mesma dica no mesmo dia, e ela roda ao longo do mês.
export function tipOfTheDay(d: Date): string {
  return DAILY_TIPS[d.getUTCDate() % DAILY_TIPS.length]!;
}
