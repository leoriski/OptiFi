import { describe, it, expect } from 'vitest';
import { importCadence, prevMonthKey } from '../src/index.js';

const JULY = new Date(2026, 6, 15); // 15 jul 2026 → último mês fechado = junho

describe('importCadence — streak e lembrete de retenção', () => {
  it('prevMonthKey atravessa a fronteira do ano', () => {
    expect(prevMonthKey('2026-06')).toBe('2026-05');
    expect(prevMonthKey('2026-01')).toBe('2025-12');
  });

  it('sem importações: streak 0 e sem lembrete (é o onboarding que trata)', () => {
    const c = importCadence([], JULY);
    expect(c.streak).toBe(0);
    expect(c.lastImportedMonth).toBeNull();
    expect(c.missingPrevMonth).toBe(false);
  });

  it('meses seguidos contam como streak; junho fechado importado = em dia', () => {
    const c = importCadence(['2026-06', '2026-05', '2026-04'], JULY);
    expect(c.streak).toBe(3);
    expect(c.lastImportedMonth).toBe('2026-06');
    expect(c.missingPrevMonth).toBe(false); // junho (mês fechado) está importado
  });

  it('falha no meio quebra o streak (conta só a partir do último)', () => {
    const c = importCadence(['2026-06', '2026-04', '2026-03'], JULY);
    expect(c.streak).toBe(1); // maio em falta → só junho
  });

  it('atrasado: último mês fechado por importar dispara o lembrete', () => {
    const c = importCadence(['2026-05', '2026-04'], JULY); // falta junho
    expect(c.streak).toBe(2);
    expect(c.prevMonth).toBe('2026-06');
    expect(c.missingPrevMonth).toBe(true);
  });

  it('ordem/duplicados não afetam o cálculo', () => {
    const c = importCadence(['2026-04', '2026-06', '2026-05', '2026-06'], JULY);
    expect(c.streak).toBe(3);
    expect(c.missingPrevMonth).toBe(false);
  });
});
