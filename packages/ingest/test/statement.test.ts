import { describe, it, expect } from 'vitest';
import { ingestStatement, assignFingerprints, IngestError } from '../src/index.js';
import { REVOLUT_CSV, CGD_CSV, UNKNOWN_CSV } from './fixtures/statements.js';

const enc = new TextEncoder();

describe('pipeline completo (ingestStatement)', () => {
  it('Revolut: mês dominante maio, dias de abril excluídos, agregados corretos', () => {
    const { bank, summary } = ingestStatement(enc.encode(REVOLUT_CSV));
    expect(bank).toBe('revolut');
    expect(summary.statementMonth).toBe('2026-05');
    // O EXCHANGE de 29-04 fica fora do mês analisado
    expect(summary.transactions.every((t) => t.date.startsWith('2026-05'))).toBe(true);
    expect(summary.income).toBeCloseTo(850, 2);
    expect(summary.expenses).toBeCloseTo(42.17 + 12.99 + 7.5 + 9.99, 2);
  });

  it('categoriza com as regras PT e deteta subscrições', () => {
    const { summary } = ingestStatement(enc.encode(REVOLUT_CSV));
    const pingo = summary.transactions.find((t) => t.description.includes('Pingo Doce'))!;
    expect(pingo.category).toBe('alimentacao');
    const subs = summary.subscriptions.map((s) => s.name);
    expect(subs).toContain('Netflix.com');
    expect(subs).toContain('Spotify Premium');
    expect(summary.subscriptions.find((s) => s.name === 'Netflix.com')!.price).toBeCloseTo(12.99, 2);
  });

  it('CGD: housing fixed = EDP + NOS (habitacao), receita = salário', () => {
    const { summary } = ingestStatement(enc.encode(CGD_CSV));
    expect(summary.statementMonth).toBe('2026-05');
    expect(summary.income).toBe(1750);
    expect(summary.housingFixed).toBeCloseTo(46.33 + 39.99, 2);
    const salario = summary.transactions.find((t) => t.type === 'income')!;
    expect(salario.category).toBe('receita');
  });

  it('bankHint errado não força um parse errado — a deteção manda', () => {
    const { bank } = ingestStatement(enc.encode(CGD_CSV), { bankHint: 'revolut' });
    expect(bank).toBe('cgd');
  });

  it('formato desconhecido (banco/idioma diferente) é lido pelo detetor universal', () => {
    // Fecha;Concepto;Importe (estilo espanhol) — sem adaptador próprio, mas o
    // detetor universal infere as colunas pelo conteúdo e lê na mesma.
    const { bank, summary } = ingestStatement(enc.encode(UNKNOWN_CSV));
    expect(bank).toBe('outro');
    expect(summary.transactions.length).toBe(2);
    expect(summary.income).toBe(1200);
  });

  it('só ficheiros sem quaisquer movimentos legíveis dão erro claro', () => {
    const junk = 'Relatório mensal\nObrigado pela preferência\n';
    expect(() => ingestStatement(enc.encode(junk))).toThrowError(IngestError);
    try {
      ingestStatement(enc.encode(junk));
    } catch (e) {
      expect((e as IngestError).code).toBe('unknown_format');
    }
  });

  it('com mapeamento, o desconhecido passa', () => {
    const { bank, summary } = ingestStatement(enc.encode(UNKNOWN_CSV), {
      mapping: { headerRow: 0, dateCol: 0, descriptionCol: 1, amountCol: 2 },
    });
    expect(bank).toBe('outro');
    expect(summary.transactions).toHaveLength(2);
  });

  it('ficheiro vazio → erro claro', () => {
    expect(() => ingestStatement(new Uint8Array())).toThrowError(IngestError);
  });
});

describe('fingerprints — deduplicação em reimportações', () => {
  it('estáveis entre importações do mesmo ficheiro', () => {
    const a = ingestStatement(enc.encode(REVOLUT_CSV)).summary.transactions.map((t) => t.fingerprint);
    const b = ingestStatement(enc.encode(REVOLUT_CSV)).summary.transactions.map((t) => t.fingerprint);
    expect(a).toEqual(b);
  });

  it('dois movimentos idênticos no mesmo dia têm fingerprints distintas', () => {
    const txs = assignFingerprints([
      { date: '2026-05-02', description: 'Café Central', amount: 1.2, type: 'expense' },
      { date: '2026-05-02', description: 'Café Central', amount: 1.2, type: 'expense' },
    ]);
    expect(txs[0]!.fingerprint).not.toBe(txs[1]!.fingerprint);
    expect(txs[0]!.fingerprint.endsWith('|0')).toBe(true);
    expect(txs[1]!.fingerprint.endsWith('|1')).toBe(true);
  });
});
