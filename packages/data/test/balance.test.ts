import { describe, expect, it } from 'vitest';
import { OPENING_NOTE, computeBalanceAnchor, splitOpening } from '../src/balance.js';
import type { ManualRow } from '../src/types.js';

const ANCHOR = '2026-08-20T10:00:00.000Z';
const BEFORE = '2026-08-19T10:00:00.000Z';
const AFTER = '2026-08-21T10:00:00.000Z';

function row(over: Partial<ManualRow> = {}): ManualRow {
  return {
    id: 'x',
    month: '2026-08',
    entry_type: 'expense',
    amount: 10,
    category: 'outros',
    note: 'algo',
    created_at: AFTER,
    paid_at: AFTER,
    ...over,
  } as ManualRow;
}

const opening = row({ id: 'op', entry_type: 'income', amount: 1000, note: OPENING_NOTE, created_at: ANCHOR });

describe('splitOpening', () => {
  it('escolhe a abertura mais recente e devolve o resto como fluxo', () => {
    const velha = row({ id: 'velha', note: OPENING_NOTE, amount: 500, created_at: BEFORE });
    const { opening: op, flow } = splitOpening([velha, opening, row({ id: 'gasto' })]);
    expect(op?.id).toBe('op');
    expect(flow.map((f) => f.id)).toEqual(['gasto']);
  });

  it('sem abertura devolve null e não perde movimentos', () => {
    const { opening: op, flow } = splitOpening([row({ id: 'a' }), row({ id: 'b' })]);
    expect(op).toBeNull();
    expect(flow).toHaveLength(2);
  });
});

describe('computeBalanceAnchor', () => {
  it('sem âncora não há saldo — devolve null em vez de zero', () => {
    expect(computeBalanceAnchor(null, [row()], [], [])).toBeNull();
  });

  it('uma despesa paga depois da âncora baixa o saldo', () => {
    const r = computeBalanceAnchor(opening, [row({ amount: 30 })], [], []);
    expect(r).toEqual({ anchor: 1000, adjustedNet: -30 });
  });

  it('uma receita registada depois da âncora sobe o saldo', () => {
    const r = computeBalanceAnchor(opening, [row({ entry_type: 'income', amount: 50 })], [], []);
    expect(r?.adjustedNet).toBe(50);
  });

  it('ignora o que já estava refletido na âncora', () => {
    const antiga = row({ amount: 30, created_at: BEFORE, paid_at: BEFORE });
    expect(computeBalanceAnchor(opening, [antiga], [], [])?.adjustedNet).toBe(0);
  });

  it('uma despesa por pagar não mexe no saldo', () => {
    expect(computeBalanceAnchor(opening, [row({ paid_at: null })], [], [])?.adjustedNet).toBe(0);
  });

  it('uma despesa apontada antes mas paga depois da âncora conta', () => {
    const tardia = row({ amount: 40, created_at: BEFORE, paid_at: AFTER });
    expect(computeBalanceAnchor(opening, [tardia], [], [])?.adjustedNet).toBe(-40);
  });

  it('uma despesa apontada depois mas paga antes da âncora não conta', () => {
    const precoce = row({ amount: 40, created_at: AFTER, paid_at: BEFORE });
    expect(computeBalanceAnchor(opening, [precoce], [], [])?.adjustedNet).toBe(0);
  });

  it('o cartão refeição não sai da conta', () => {
    expect(computeBalanceAnchor(opening, [row({ amount: 25, meal_card: true })], [], [])?.adjustedNet).toBe(0);
  });

  it('alocar a uma meta é uma transferência que baixa o saldo', () => {
    expect(computeBalanceAnchor(opening, [], [{ amount: 200, created_at: AFTER }], [])?.adjustedNet).toBe(-200);
  });

  it('levantar de uma meta devolve o dinheiro à conta', () => {
    expect(computeBalanceAnchor(opening, [], [], [{ amount: 150, created_at: AFTER }])?.adjustedNet).toBe(150);
  });

  it('alocações e levantamentos anteriores à âncora já lá estão', () => {
    const r = computeBalanceAnchor(
      opening,
      [],
      [{ amount: 200, created_at: BEFORE }],
      [{ amount: 150, created_at: BEFORE }],
    );
    expect(r?.adjustedNet).toBe(0);
  });

  it('arredonda aos cêntimos em vez de deixar lixo de vírgula flutuante', () => {
    const r = computeBalanceAnchor(opening, [row({ amount: 0.1 }), row({ amount: 0.2 })], [], []);
    expect(r?.adjustedNet).toBe(-0.3);
  });
});
