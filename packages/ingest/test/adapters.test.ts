import { describe, it, expect } from 'vitest';
import { parseCsv, detectBank, revolutAdapter, cgdAdapter, bcpAdapter, parseWithMapping, IngestError } from '../src/index.js';
import { REVOLUT_CSV, CGD_CSV, BCP_CSV, UNKNOWN_CSV } from './fixtures/statements.js';

describe('deteção automática de banco', () => {
  it('reconhece os três formatos e rejeita desconhecidos', () => {
    expect(detectBank(parseCsv(REVOLUT_CSV))).toBe('revolut');
    expect(detectBank(parseCsv(CGD_CSV))).toBe('cgd');
    expect(detectBank(parseCsv(BCP_CSV))).toBe('bcp');
    expect(detectBank(parseCsv(UNKNOWN_CSV))).toBeNull();
  });
});

describe('Revolut', () => {
  const { txs, endingBalance } = revolutAdapter.parse(parseCsv(REVOLUT_CSV));

  it('só movimentos COMPLETED (REVERTED fica de fora)', () => {
    expect(txs).toHaveLength(6);
    expect(txs.find((t) => t.description === 'Bolt PT')).toBeUndefined();
  });

  it('sinal → tipo; a fee soma à despesa', () => {
    const uber = txs.find((t) => t.description === 'Uber *Trip')!;
    expect(uber.type).toBe('expense');
    expect(uber.amount).toBeCloseTo(7.5, 2); // 7.35 + 0.15 fee
    const trf = txs.find((t) => t.description.startsWith('Transferência'))!;
    expect(trf.type).toBe('income');
    expect(trf.amount).toBe(850);
  });

  it('usa a Completed Date (não a Started)', () => {
    expect(txs.find((t) => t.description === 'Pingo Doce Lisboa')!.date).toBe('2026-05-03');
  });

  it('captura o saldo final (Balance do movimento mais recente)', () => {
    expect(endingBalance).toBeCloseTo(1924.03, 2);
  });
});

describe('CGD', () => {
  const { txs, endingBalance } = cgdAdapter.parse(parseCsv(CGD_CSV));

  it('salta preâmbulo e rodapé; débito/crédito → tipo', () => {
    expect(txs).toHaveLength(5);
    const salario = txs.find((t) => t.description.includes('SALARIO'))!;
    expect(salario.type).toBe('income');
    expect(salario.amount).toBe(1750);
    const edp = txs.find((t) => t.description.includes('EDP'))!;
    expect(edp.type).toBe('expense');
    expect(edp.amount).toBeCloseTo(46.33, 2);
  });

  it('datas DD-MM-YYYY convertidas para ISO', () => {
    expect(txs[0]!.date).toBe('2026-05-02');
  });

  it('captura o saldo contabilístico final', () => {
    expect(endingBalance).toBeCloseTo(3545.48, 2);
  });
});

describe('Millennium BCP', () => {
  const { txs, endingBalance } = bcpAdapter.parse(parseCsv(BCP_CSV));

  it('montante único assinado → tipo', () => {
    expect(txs).toHaveLength(5);
    expect(txs.find((t) => t.description === 'ORDENADO MAIO')!.type).toBe('income');
    const renda = txs.find((t) => t.description.includes('RENDA'))!;
    expect(renda.type).toBe('expense');
    expect(renda.amount).toBe(450);
  });

  it('captura o saldo final', () => {
    expect(endingBalance).toBeCloseTo(3975.74, 2);
  });
});

describe('mapeador universal', () => {
  it('parseia um formato desconhecido com o mapeamento do utilizador', () => {
    const txs = parseWithMapping(parseCsv(UNKNOWN_CSV), {
      headerRow: 0,
      dateCol: 0,
      descriptionCol: 1,
      amountCol: 2,
    });
    expect(txs).toHaveLength(2);
    expect(txs[0]).toEqual({ date: '2026-05-02', description: 'SUPERMERCADO DIA', amount: 23.5, type: 'expense' });
    expect(txs[1]!.type).toBe('income');
  });

  it('rejeita mapeamento sem coluna de valor', () => {
    expect(() =>
      parseWithMapping(parseCsv(UNKNOWN_CSV), { headerRow: 0, dateCol: 0, descriptionCol: 1 }),
    ).toThrowError(IngestError);
  });
});

describe('Revolut — exportação com a app em português', () => {
  const PT_CSV = [
    'Tipo,Produto,Data de início,Data de conclusão,Descrição,Montante,Taxa,Moeda,Estado,Saldo',
    'CARD_PAYMENT,Current,2026-06-02 10:00:00,2026-06-02 10:00:05,Pingo Doce Lisboa,-23.40,0.00,EUR,CONCLUÍDO,976.60',
    'TRANSFER,Current,2026-06-05 09:00:00,2026-06-05 09:00:01,Ordenado,1800.00,0.00,EUR,CONCLUÍDO,2776.60',
    'CARD_PAYMENT,Current,2026-06-07 20:00:00,,Bolt PT,-6.20,0.00,EUR,REVERTIDO,',
  ].join('\n');

  it('deteta cabeçalhos PT (Data de início/Estado) e estados CONCLUÍDO', () => {
    const rows = parseCsv(PT_CSV);
    expect(detectBank(rows)).toBe('revolut');
    const { txs, endingBalance } = revolutAdapter.parse(rows);
    expect(txs).toHaveLength(2); // REVERTIDO fica de fora
    expect(txs[0]).toMatchObject({ description: 'Pingo Doce Lisboa', type: 'expense', amount: 23.4 });
    expect(txs[1]).toMatchObject({ type: 'income', amount: 1800 });
    expect(endingBalance).toBeCloseTo(2776.6, 2);
  });
});
