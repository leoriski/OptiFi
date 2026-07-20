import { describe, it, expect } from 'vitest';
import { computeFinancialState, computeBudgetRule } from '../src/index.js';
import { baselineInput } from './fixtures/baseline.js';

describe('cartão refeição — pote próprio, fora do dinheiro da conta', () => {
  it('recebes X, gastas Y com o cartão → restam Z; a conta bancária não mexe', () => {
    const input = baselineInput({ balance: { anchor: 1000, adjustedNet: 0 }, mealCardMonthly: 176 });
    input.manualEntries = [
      { id: 'a', month: '2026-06', type: 'expense', amount: 45.5, category: 'alimentacao', viaMealCard: true },
      { id: 'b', month: '2026-06', type: 'expense', amount: 30, category: 'alimentacao', viaMealCard: true },
      { id: 'c', month: '2026-06', type: 'expense', amount: 20, category: 'lazer' }, // conta normal
    ];
    const s = computeFinancialState(input);
    expect(s.mealCard).toEqual({ monthly: 176, spent: 75.5, left: 100.5 });
    // As despesas do cartão NÃO tocam no dinheiro da conta:
    expect(s.manualExpensesThisMonth).toBe(20);
    expect(s.manualNet).toBe(-20);
  });

  it('despesas do cartão não contam para os limites por categoria', () => {
    const input = baselineInput({ categoryLimits: { alimentacao: 100 }, mealCardMonthly: 176 });
    input.manualEntries = [
      { id: 'a', month: '2026-06', type: 'expense', amount: 90, category: 'alimentacao', viaMealCard: true },
      { id: 'b', month: '2026-06', type: 'expense', amount: 30, category: 'alimentacao' },
    ];
    const s = computeFinancialState(input);
    expect(s.categoryLimitStates['alimentacao']!.spent).toBe(30); // só a despesa da conta
  });

  it('sem cartão nem gastos de cartão → null (não inventa o pote)', () => {
    const s = computeFinancialState(baselineInput());
    expect(s.mealCard).toBeNull();
  });
});

describe('regra 50/30/20 personalizada', () => {
  it('essenciais a 50% do rendimento → a regra clássica 50/30/20', () => {
    const r = computeBudgetRule(2000, [
      { categoryId: 'habitacao', amount: 700 },
      { categoryId: 'alimentacao', amount: 300 }, // essenciais: 1000 = 50%
      { categoryId: 'lazer', amount: 250 },
      { categoryId: 'subscricoes', amount: 50 },
    ])!;
    expect([r.needsPct, r.wantsPct, r.savingsPct]).toEqual([50, 30, 20]);
    expect(r.needsEur).toBe(1000);
    expect(r.wantsEur).toBe(600);
    expect(r.savingsEur).toBe(400);
    expect(r.wantsActualEur).toBe(300);
  });

  it('essenciais mais pesados → regra adaptada (60/24/16), sempre a somar 100', () => {
    const r = computeBudgetRule(2000, [
      { categoryId: 'habitacao', amount: 900 },
      { categoryId: 'alimentacao', amount: 200 },
      { categoryId: 'transporte', amount: 100 }, // 1200 = 60%
    ])!;
    expect([r.needsPct, r.wantsPct, r.savingsPct]).toEqual([60, 24, 16]);
    expect(r.needsPct + r.wantsPct + r.savingsPct).toBe(100);
  });

  it('comer fora conta como pessoais (lazer), não como essenciais', () => {
    const r = computeBudgetRule(1000, [
      { categoryId: 'alimentacao', amount: 200 }, // supermercado → essencial
      { categoryId: 'lazer', amount: 150 }, // restaurantes/saídas → pessoais
    ])!;
    expect(r.needsEur).toBe(200);
    expect(r.wantsActualEur).toBe(150);
  });

  it('essenciais esmagadores são limitados a 90% (a regra não finge folga)', () => {
    const r = computeBudgetRule(1000, [{ categoryId: 'habitacao', amount: 980 }])!;
    expect(r.needsPct).toBe(90);
    expect(r.needsPct + r.wantsPct + r.savingsPct).toBe(100);
  });

  it('sem rendimento não há regra', () => {
    expect(computeBudgetRule(0, [])).toBeNull();
  });
});
