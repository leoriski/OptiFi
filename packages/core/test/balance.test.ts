import { describe, it, expect } from 'vitest';
import { computeFinancialState } from '../src/index.js';
import { baselineInput, PROTOTYPE_PLAN_MONTH } from './fixtures/baseline.js';

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

// O gesto real: recebe-se o salário e regista-se logo tudo o que há a pagar,
// para saber com quanto se fica. Enquanto essas despesas não saem da conta, o
// saldo tem de continuar a mostrá-las — o que não pode é o dinheiro aparecer
// como disponível para gastar.
describe('despesas por pagar: baixam o disponível, não o saldo', () => {
  const bill = (id: string, amount: number, paid: boolean) => ({
    id,
    month: PROTOTYPE_PLAN_MONTH,
    type: 'expense' as const,
    amount,
    paid,
  });

  it('uma despesa por pagar sai do disponível e deixa o saldo intacto', () => {
    const s = computeFinancialState(
      baselineInput({
        balance: { anchor: 1000, adjustedNet: 0 },
        manualEntries: [bill('m1', 500, false)],
      }),
    );
    expect(s.currentBalance).toBe(1000); // o dinheiro ainda está na conta
    expect(s.unpaidExpensesThisMonth).toBe(500);
    expect(s.spendableNow).toBe(500); // mas já tem dono
  });

  it('marcar como paga move o valor de um lado para o outro: o disponível não muda', () => {
    const unpaid = computeFinancialState(
      baselineInput({ balance: { anchor: 1000, adjustedNet: 0 }, manualEntries: [bill('m1', 500, false)] }),
    );
    // Ao pagar, o banco debita: a âncora do saldo passa a refletir a saída
    // (adjustedNet −500) e a despesa deixa de estar por pagar.
    const paid = computeFinancialState(
      baselineInput({ balance: { anchor: 1000, adjustedNet: -500 }, manualEntries: [bill('m1', 500, true)] }),
    );
    expect(paid.currentBalance).toBe(500);
    expect(paid.unpaidExpensesThisMonth).toBe(0);
    expect(paid.spendableNow).toBe(unpaid.spendableNow); // 500 nos dois casos
  });

  it('reservado para metas e por pagar somam-se no disponível, sem se atropelarem', () => {
    const input = baselineInput({
      balance: { anchor: 1000, adjustedNet: 0 },
      manualEntries: [bill('m1', 500, false), bill('m2', 62, false), bill('m3', 150, true)],
    });
    input.goals.find((g) => g.id === 'g1')!.monthlyAllocation = 150;
    const s = computeFinancialState(input);
    expect(s.unpaidExpensesThisMonth).toBe(562); // a paga fica de fora
    expect(s.spendableNow).toBe(288); // 1000 − 150 reservados − 562 por pagar
  });

  it('despesa do cartão refeição nunca entra no por pagar — não sai da conta', () => {
    const s = computeFinancialState(
      baselineInput({
        balance: { anchor: 1000, adjustedNet: 0 },
        mealCardMonthly: 200,
        manualEntries: [{ id: 'm1', month: PROTOTYPE_PLAN_MONTH, type: 'expense', amount: 40, viaMealCard: true }],
      }),
    );
    expect(s.unpaidExpensesThisMonth).toBe(0);
    expect(s.spendableNow).toBe(1000);
  });

  it('dever mais do que se tem deixa o disponível negativo, sem esconder nada', () => {
    const s = computeFinancialState(
      baselineInput({ balance: { anchor: 300, adjustedNet: 0 }, manualEntries: [bill('m1', 500, false)] }),
    );
    expect(s.currentBalance).toBe(300);
    expect(s.spendableNow).toBe(-200);
  });
});
