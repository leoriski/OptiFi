import { describe, it, expect } from 'vitest';
import { computeFinancialState } from '../src/index.js';
import { baselineInput } from './fixtures/baseline.js';

function withStatus(id: string, status: 'confirmed' | 'rejected' | 'cancelled') {
  const input = baselineInput();
  input.subs.find((s) => s.id === id)!.userStatus = status;
  return input;
}

describe('subscription verdicts ripple through the whole state', () => {
  it('cancelling HBO Max removes €8.99 from subsTotal and raises the pace', () => {
    const s = computeFinancialState(withStatus('s4', 'cancelled'));
    expect(s.subsTotal).toBeCloseTo(77.34, 2);
    // fixedCommitted drops → variable budget grows → weekly pace rises
    expect(s.safePace.weeklyPace).toBeCloseTo((2100 - (77.34 + 482.4) - 420) / 4.3, 2);
    expect(s.safePace.weeklyPace).toBeGreaterThan(258.44);
  });

  it('rejeitar uma subscrição já NÃO penaliza o pilar de subscrições (passou ao money leak)', () => {
    // O leak vem de fora (generateAnalysis); aqui o baseLeak é fixo, por isso
    // marcar rejected mantém o pilar 18 e o total 57. A penalização real da
    // subscrição "não vale" está no money leak — testada em analyze.test.ts.
    const s = computeFinancialState(withStatus('s4', 'rejected'));
    expect(s.score.breakdown[1]!.value).toBe(18);
    expect(s.score.total).toBe(57);
  });

  it('reviewing every subscription earns the +8 clarity bonus', () => {
    const input = baselineInput();
    for (const sub of input.subs) sub.userStatus = 'confirmed';
    const s = computeFinancialState(input);
    expect(s.score.breakdown[1]!.value).toBe(26);
    expect(s.score.total).toBe(65);
  });

  it('cancelled subs are excluded from the unknown count', () => {
    const input = baselineInput();
    for (const sub of input.subs) sub.userStatus = 'cancelled';
    const s = computeFinancialState(input);
    expect(s.subsTotal).toBe(0);
    expect(s.score.subsUnknown).toBe(0);
    // ratio 0 → 25, +8 bonus → 33 (pillar ceiling)
    expect(s.score.breakdown[1]!.value).toBe(33);
  });
});

describe('subscrições por pagar no mês corrente', () => {
  it('sem registos manuais, todas as ativas estão por pagar', () => {
    const s = computeFinancialState(baselineInput());
    expect(s.subsPending.total).toBeCloseTo(s.subsTotal, 2);
    expect(s.subsPending.items).toHaveLength(8);
  });

  it('uma cancelada sai da conta', () => {
    const s = computeFinancialState(withStatus('s4', 'cancelled'));
    expect(s.subsPending.total).toBeCloseTo(77.34, 2);
    expect(s.subsPending.items.map((i) => i.name)).not.toContain('Hbo Max');
  });

  it('registar a subscrição à mão tira-a da lista — não conta duas vezes', () => {
    const s = computeFinancialState(
      baselineInput({
        manualEntries: [
          { id: 'm1', month: '2026-06', type: 'expense', amount: 12.99, category: 'subscricoes', note: 'Netflix' },
        ],
      }),
    );
    expect(s.subsPending.items.map((i) => i.name)).not.toContain('Netflix');
    expect(s.subsPending.total).toBeCloseTo(86.33 - 12.99, 2);
  });

  it('o registo de outro mês não conta — cada mês tem de ser pago de novo', () => {
    const s = computeFinancialState(
      baselineInput({
        manualEntries: [
          { id: 'm1', month: '2026-05', type: 'expense', amount: 12.99, category: 'subscricoes', note: 'Netflix' },
        ],
      }),
    );
    expect(s.subsPending.items.map((i) => i.name)).toContain('Netflix');
  });

  it('não desconta do disponível: quem decide é a lista de despesas', () => {
    const base = baselineInput({ balance: { anchor: 1000, adjustedNet: 0 } });
    const s = computeFinancialState(base);
    expect(s.subsPending.total).toBeGreaterThan(0);
    // O saldo disponível ignora-as de propósito — a app não sabe o dia da
    // cobrança e o saldo do banco pode já as excluir.
    expect(s.spendableNow).toBe(1000 - s.allocatedTotal);
  });
});
