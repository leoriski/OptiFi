import { describe, it, expect } from 'vitest';
import { parsePdfStatementLines, pdfContentStart, IngestError } from '../src/index.js';

/**
 * Modelo real dos extratos PDF portugueses (validado com ficheiros reais de
 * Millennium BCP e Santander): cada movimento começa com data(s) e termina com
 * [VALOR, SALDO]; o penúltimo número é o valor, o último o saldo.
 */

describe('parser PDF — Millennium BCP (datas "6.01", valor embutido, saldo decide)', () => {
  const lines = [
    '26/06/30 CONTA: 45813508856 PAG: 00002',
    'EXTRATO DE 2026/06/01 A 2026/06/30',
    'DATA DATA',
    'LANC. VALOR DESCRITIVO DEBITO CREDITO SALDO',
    'SALDO INICIAL 1 135.36',
    '6.01 6.01 TRF MB WAY P/ CARLA ALEXANDRA VUMI MIRANDA 199.92 935.44',
    '6.01 5.31 TRF. P/O DELFIO LUIS OFESSE 10.00 945.44',
    '6.02 6.02 COMISSAO TRF MBWAY 199.92 APP MB WAY 0.40 945.04',
    '6.02 6.02 IMPOSTO DO SELO 0.02 945.02',
    'A TRANSPORTAR 945.02',
  ];

  it('lê datas mês.dia, resolve o sinal pela variação do saldo', () => {
    const r = parsePdfStatementLines(lines);
    expect(r.txs).toHaveLength(4);
    expect(r.txs[0]).toEqual({ date: '2026-06-01', description: 'TRF MB WAY P/ CARLA ALEXANDRA VUMI MIRANDA', amount: 199.92, type: 'expense' });
    expect(r.txs[1]!.type).toBe('income'); // TRF. P/O → saldo sobe
    expect(r.endingBalance).toBe(945.02);
  });

  it('o valor é o penúltimo número (ignora o montante embutido na descrição)', () => {
    const r = parsePdfStatementLines(lines);
    const comissao = r.txs.find((t) => t.description.startsWith('COMISSAO'))!;
    expect(comissao.amount).toBe(0.4); // não 199.92
    expect(comissao.type).toBe('expense');
    expect(comissao.description).toBe('COMISSAO TRF MBWAY 199.92 APP MB WAY');
  });
});

describe('parser PDF — Santander (datas "01-06", montante assinado, exclui descoberto)', () => {
  const lines = [
    'EXTRATO Nº 27 CONTA Nº 0003.62277496020 PERÍODO DE 2026-05-30 A 2026-06-30 PÁGINA 002/003',
    'Mov Valor Descritivo do Movimento Moeda Valor Saldo',
    'Saldo Inicial EUR 4,99',
    '01-06 01-06 TRF.IMED. DE DELFIO LUIS OFESSE-R84994566 50,00 54,99',
    '01-06 01-06 LEVANTAMENTO DE NUMERARIO-5297 -20,00 34,99',
    '05-06 04-06 COMPRA *5297 PINGO DOCE CONSTITUIPORTO -29,97 5,02',
    'Saldo Disponível Final EUR 560,57',
    'Descritivo de Movimentos de Facilidade Descoberto e/ou Ultrapassagem de Crédito',
    '11-05 -0,04 EUR 14 -0,04 Ultrap.cred 15,100%',
  ];

  it('sinal explícito (positivo=entrada), datas dia-mês, exclui a secção de descoberto', () => {
    const r = parsePdfStatementLines(lines);
    expect(r.txs).toHaveLength(3); // a linha de descoberto/juros NÃO conta
    expect(r.txs.map((t) => t.type)).toEqual(['income', 'expense', 'expense']);
    expect(r.txs.map((t) => t.amount)).toEqual([50, 20, 29.97]);
    expect(r.txs[0]!.date).toBe('2026-06-01');
    expect(r.txs[0]!.description).toBe('TRF.IMED. DE DELFIO LUIS OFESSE-R84994566');
    expect(r.endingBalance).toBe(5.02);
  });
});

describe('parser PDF — casos gerais', () => {
  it('montante assinado sem saldo: negativo=despesa, positivo=receita', () => {
    const r = parsePdfStatementLines([
      'Período de 2026-06-01 a 2026-06-30',
      '2026-06-03 Spotify Premium -9,99',
      '2026-06-05 Transferencia recebida 250,00',
      '2026-06-07 Cafe Central -2,40',
    ]);
    expect(r.txs.map((t) => t.type)).toEqual(['expense', 'income', 'expense']);
    expect(r.endingBalance).toBeUndefined();
  });

  it('milhares com espaço e código de moeda sobrevivem', () => {
    const r = parsePdfStatementLines([
      'EXTRATO DE 2026/06/01 A 2026/06/30',
      'SALDO INICIAL 10 000.00',
      '15-06 RENDA CASA 1 234.56 8 765.44',
    ]);
    expect(r.txs[0]!.amount).toBe(1234.56);
    expect(r.txs[0]!.type).toBe('expense');
  });

  it('PDF sem movimentos → pdf_unreadable', () => {
    expect(() => parsePdfStatementLines(['Fatura nº 123', 'Total: obrigado'])).toThrowError(IngestError);
  });
});

describe('pdfContentStart — encontra o %PDF mesmo com lixo à frente', () => {
  it('%PDF no início → offset 0', () => {
    const b = new TextEncoder().encode('%PDF-1.7\n...');
    expect(pdfContentStart(b)).toBe(0);
  });
  it('cabeçalho de serialização Java antes do %PDF (extrato real Santander) → offset do %PDF', () => {
    const prefix = new Uint8Array([0xac, 0xed, 0x00, 0x05, 0x75, 0x72, 0x00, 0x02]);
    const pdf = new TextEncoder().encode('%PDF-1.7\n');
    const b = new Uint8Array([...prefix, ...pdf]);
    expect(pdfContentStart(b)).toBe(8);
  });
  it('sem %PDF → -1 (é tratado como CSV/texto)', () => {
    expect(pdfContentStart(new TextEncoder().encode('Data;Descricao;Valor\n01-06-2026;X;-5,00'))).toBe(-1);
  });
});
