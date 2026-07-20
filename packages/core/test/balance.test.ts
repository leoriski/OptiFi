import { describe, it, expect } from 'vitest';
import { computeFinancialState } from '../src/index.js';
import { baselineInput } from './fixtures/baseline.js';

describe('saldo real ligado a tudo (âncora + registos)', () => {
  it('sem âncora definida, o saldo é null (nunca inventado)', () => {
    const s = computeFinancialState(baselineInput());
    expect(s.currentBalance).toBeNull();
    expect(s.spendableNow).toBeNull();
  });

  it('âncora + registos posteriores = saldo atual; reservar para metas reduz o gastável', () => {
    const input = baselineInput({ balance: { anchor: 1200, adjustedNet: -50.25 } });
    input.goals.find((g) => g.id === 'g1')!.monthlyAllocation = 300;
    const s = computeFinancialState(input);
    expect(s.currentBalance).toBe(1149.75);
    expect(s.spendableNow).toBe(849.75); // 1149.75 − 300 reservados
  });

  it('a reserva da meta só sai do gastável a partir do dia de alocação', () => {
    const input = baselineInput({ balance: { anchor: 1000, adjustedNet: 0 }, today: new Date(2026, 4, 3) });
    const g = input.goals.find((x) => x.id === 'g1')!;
    g.monthlyAllocation = 200;
    g.allocationDay = 10; // hoje é dia 3 → ainda NÃO reservado
    let s = computeFinancialState(input);
    expect(s.allocatedTotal).toBe(0);
    expect(s.spendableNow).toBe(1000); // dinheiro ainda livre

    input.today = new Date(2026, 4, 15); // passou o dia 10 → reservado
    s = computeFinancialState(input);
    expect(s.allocatedTotal).toBe(200);
    expect(s.spendableNow).toBe(800);
  });

  it('meta JÁ alocada este mês não é descontada do saldo (o dinheiro já saiu)', () => {
    const input = baselineInput({ balance: { anchor: 1000, adjustedNet: 0 }, today: new Date(2026, 4, 15) });
    const g = input.goals.find((x) => x.id === 'g1')!;
    g.monthlyAllocation = 100;
    g.allocationDay = 1; // dia já passou

    // Por alocar e vencida → reservada (desconta): spendable 900
    let s = computeFinancialState(input);
    expect(s.goalAllocationStatus['g1']).toBe('due');
    expect(s.spendableNow).toBe(900);

    // Marcada como já alocada → o saldo indicado já a exclui → não desconta
    input.allocatedGoalIds = ['g1'];
    s = computeFinancialState(input);
    expect(s.goalAllocationStatus['g1']).toBe('done');
    expect(s.allocatedTotal).toBe(0);
    expect(s.spendableNow).toBe(1000);
  });

  it('meta agendada para dia futuro fica "scheduled" e não desconta', () => {
    const input = baselineInput({ balance: { anchor: 1000, adjustedNet: 0 }, today: new Date(2026, 4, 3) });
    const g = input.goals.find((x) => x.id === 'g1')!;
    g.monthlyAllocation = 100;
    g.allocationDay = 20; // ainda não chegou
    const s = computeFinancialState(input);
    expect(s.goalAllocationStatus['g1']).toBe('scheduled');
    expect(s.spendableNow).toBe(1000);
  });

  it('o gastável pode ser negativo — a verdade vem sempre com sinal', () => {
    const s = computeFinancialState(baselineInput({ balance: { anchor: 100, adjustedNet: -180 } }));
    expect(s.currentBalance).toBe(-80);
    expect(s.spendableNow).toBe(-80); // saldo −80, nada reservado → gastável −80
  });

  it('reservar mais do que o saldo torna o gastável negativo', () => {
    const input = baselineInput({ balance: { anchor: 200, adjustedNet: 0 } });
    input.goals.find((g) => g.id === 'g1')!.monthlyAllocation = 300;
    const s = computeFinancialState(input);
    expect(s.spendableNow).toBe(-100); // 200 − 300 reservados
  });

  it('um registo manual novo mexe no saldo via adjustedNet — a ligação total', () => {
    const before = computeFinancialState(baselineInput({ balance: { anchor: 1000, adjustedNet: 0 } }));
    const after = computeFinancialState(baselineInput({ balance: { anchor: 1000, adjustedNet: -38.5 } }));
    expect(before.currentBalance! - after.currentBalance!).toBeCloseTo(38.5, 2);
  });
});
