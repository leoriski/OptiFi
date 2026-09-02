import { describe, it, expect } from 'vitest';
import { fmtEur, fmtEur0, fill, monthLabel, monthShort, dayShort, dayShortFromIso } from '../src/index.js';

describe('formatadores partilhados', () => {
  it('fmtEur — formato português (€, . milhares, , decimal)', () => {
    expect(fmtEur(1120.2)).toBe('€1.120,20');
    expect(fmtEur(0)).toBe('€0,00');
    expect(fmtEur(-199.92)).toBe('-€199,92');
    expect(fmtEur(1000)).toBe('€1.000,00');
  });

  it('fmtEur0 — sem casas decimais', () => {
    expect(fmtEur0(219.49)).toBe('€219');
    expect(fmtEur0(2628.4)).toBe('€2.628');
    expect(fmtEur0(-760)).toBe('-€760');
  });

  it('monthLabel — determinista, sem Intl (Hermes-safe)', () => {
    expect(monthLabel('2026-06')).toBe('Junho 2026');
    expect(monthLabel('2026-01', 'pt')).toBe('Janeiro 2026');
    expect(monthLabel('2026-06', 'en')).toBe('June 2026');
    expect(monthLabel('2026-12', 'en')).toBe('December 2026');
  });

  it('monthShort — curto, minúsculas em pt e capitalizado em en', () => {
    expect(monthShort('2026-06')).toBe('jun');
    expect(monthShort('2026-06', 'en')).toBe('Jun');
    expect(monthShort('2026-12', 'en')).toBe('Dec');
  });

  it('dayShort / dayShortFromIso', () => {
    expect(dayShort('2026-06-14')).toBe('14 JUN');
    expect(dayShortFromIso('2026-06-14T10:00:00Z')).toBe('14 jun');
  });

  it('fill — substitui {chaves} no template', () => {
    expect(fill('gastaste {amount} em {month}', { amount: '€219', month: 'Junho' })).toBe('gastaste €219 em Junho');
  });
});