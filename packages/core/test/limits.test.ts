import { describe, it, expect } from 'vitest';
import { categoryLimitStatus, computeFinancialState } from '../src/index.js';
import { baselineInput } from './fixtures/baseline.js';

describe('category limits (micro-budget)', () => {
  it('status bands: ok ≤ limit, tight ≤ 110%, over beyond', () => {
    expect(categoryLimitStatus(180, 200)).toBe('ok');
    expect(categoryLimitStatus(180, 180)).toBe('ok');
    expect(categoryLimitStatus(180, 170)).toBe('tight'); // 180 ≤ 187
    expect(categoryLimitStatus(180, 150)).toBe('over'); // 180 > 165
  });

  it('o potencial ("se cumprires libertas X") compara o limite com o mês ANALISADO', () => {
    const s = computeFinancialState(baselineInput({ categoryLimits: { Restaurants: 150 } }));
    expect(s.limitsCount).toBe(1);
    expect(s.limitsSavingsPotential).toBe(30); // gastaste 180 no mês analisado, limite 150
  });

  it('o ESTADO do limite mede o mês corrente: sem registos ainda, está "Dentro"', () => {
    const s = computeFinancialState(baselineInput({ categoryLimits: { Restaurants: 150 } }));
    expect(s.categoryLimitStates['Restaurants']).toEqual({
      spent: 0,
      limit: 150,
      overBy: 0,
      state: 'ok',
    });
  });

  it('registos do mês corrente aproximam e ultrapassam o limite (ok → tight → over)', () => {
    const base = baselineInput({ categoryLimits: { alimentacao: 100 } });
    base.manualEntries = [
      { id: 'm1', month: '2026-06', type: 'expense', amount: 60, category: 'alimentacao' },
      { id: 'm2', month: '2026-06', type: 'expense', amount: 45, category: 'alimentacao' },
      { id: 'fora', month: '2026-05', type: 'expense', amount: 500, category: 'alimentacao' }, // outro mês: não conta
    ];
    const s = computeFinancialState(base);
    expect(s.categoryLimitStates['alimentacao']).toEqual({
      spent: 105,
      limit: 100,
      overBy: 5,
      state: 'tight', // 105 ≤ 110
    });
  });

  it('limits above spend contribute no potential', () => {
    const s = computeFinancialState(baselineInput({ categoryLimits: { Restaurants: 250, Transport: 100 } }));
    expect(s.limitsCount).toBe(2);
    expect(s.limitsSavingsPotential).toBe(0);
  });

  it('valores inválidos são ignorados; categoria sem registos conta a zero', () => {
    const s = computeFinancialState(
      baselineInput({ categoryLimits: { Inexistente: 50, Restaurants: -10 } }),
    );
    // 'Inexistente' é acompanhável no mês corrente (0 gasto); o limite negativo cai.
    expect(s.limitsCount).toBe(1);
    expect(s.categoryLimitStates['Inexistente']!.spent).toBe(0);
    expect(s.categoryLimitStates['Restaurants']).toBeUndefined();
  });

  it('the discipline bonus nudges the leaks pillar but is separate from the leak itself', () => {
    const s = computeFinancialState(baselineInput({ categoryLimits: { Restaurants: 150 } }));
    // leak unchanged — the limit refines a category's waste, it doesn't stack
    expect(s.leakTotal).toBe(219);
    // 5 + min(30/2100*20, 6) = 5.2857 → rounds to 5; total round(57.29) = 57
    expect(s.score.breakdown[2]!.value).toBe(5);
    expect(s.score.total).toBe(57);
  });
});
