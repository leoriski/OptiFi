import { describe, it, expect } from 'vitest';
import { ingestStatement, assignFingerprints, categorizeStatement, buildStatement, IngestError } from '../src/index.js';
import { REVOLUT_CSV, CGD_CSV, UNKNOWN_CSV } from './fixtures/statements.js';

const enc = new TextEncoder();

describe('subscrições do mesmo serviço cobradas mais do que uma vez', () => {
  it('junta pelo nome base e soma o que custou no mês', () => {
    const summary = buildStatement([
      { date: '2026-06-02', description: '02 FITNESS UP GROUP SGPS', amount: 39.2, type: 'expense' },
      { date: '2026-06-18', description: '18 FITNESS UP GROUP SGPS', amount: 22.6, type: 'expense' },
      { date: '2026-06-05', description: 'NETFLIX.COM', amount: 12.99, type: 'expense' },
    ]);
    expect(summary.subscriptions).toHaveLength(2);
    const gym = summary.subscriptions.find((s) => s.name.includes('FITNESS'))!;
    expect(gym.price).toBeCloseTo(61.8, 2);
  });
});

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

  it('transferências entre pessoas ficam FORA do rendimento/despesa (2 sentidos)', () => {
    const csv = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-05-02 09:14:33,2026-05-03 10:02:11,Pingo Doce Lisboa,-42.17,0.00,EUR,COMPLETED,1204.51
TRANSFER,Current,2026-05-06 11:00:00,2026-05-06 11:00:01,TRF. P/O Joao Amigo,50.00,0.00,EUR,COMPLETED,1254.51
TRANSFER,Current,2026-05-07 11:00:00,2026-05-07 11:00:01,TRF P/ Maria Colega,-30.00,0.00,EUR,COMPLETED,1224.51
TRANSFER,Current,2026-05-08 11:00:00,2026-05-08 11:00:01,Salario ACME,900.00,0.00,EUR,COMPLETED,2124.51
`;
    const { summary } = ingestStatement(enc.encode(csv));
    expect(summary.income).toBeCloseTo(900, 2); // só o salário, não a transferência recebida (50)
    expect(summary.expenses).toBeCloseTo(42.17, 2); // só o supermercado, não a transferência enviada (30)
    expect(summary.transactions.find((t) => t.description.includes('Joao'))!.category).toBe('transferencias');
    expect(summary.transactions.find((t) => t.description.includes('Maria'))!.category).toBe('transferencias');
  });

  it('formato "29 TRF Nome" do Millennium: saída é transferência; entrada só se for a mesma pessoa', () => {
    const txs = categorizeStatement([
      { description: '29 TRF Isabel Jorge Camb', type: 'expense' as const },
      { description: '06 TFI Isabel Jorge Camb', type: 'income' as const },
      { description: '29 TFI PLANO INCLINADO I', type: 'income' as const },
    ]);
    expect(txs[0]!.category).toBe('transferencias'); // enviámos-lhe dinheiro
    expect(txs[1]!.category).toBe('transferencias'); // a MESMA pessoa devolveu
    expect(txs[2]!.category).toBe('receita'); // contraparte desconhecida → rendimento
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
