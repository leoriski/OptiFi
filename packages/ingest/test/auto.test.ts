import { describe, it, expect } from 'vitest';
import { autoParse, ingestStatement, IngestError } from '../src/index.js';

/**
 * O detetor universal tem de ler QUALQUER banco/corretora presente em Portugal
 * sem mapeamento manual. Estes são os formatos reais dos que o utilizador
 * reportou a falhar: Santander, Millennium, Trading 212, Trade Republic, mais
 * o padrão débito/crédito e um caso sem cabeçalho.
 */

const toBytes = (s: string) => new TextEncoder().encode(s);

describe('detetor universal de extratos (autoParse)', () => {
  it('Santander — montante assinado + saldo, duas colunas de data', () => {
    const rows = [
      ['Data Operação', 'Data Valor', 'Descrição', 'Montante', 'Saldo'],
      ['02-06-2026', '02-06-2026', 'COMPRA CONTINENTE MATOSINHOS', '-45,67', '1.454,33'],
      ['05-06-2026', '05-06-2026', 'ORDENADO EMPRESA', '1.800,00', '3.254,33'],
      ['10-06-2026', '10-06-2026', 'NETFLIX', '-12,99', '3.241,34'],
      ['12-06-2026', '12-06-2026', 'MB WAY JOAO', '-20,00', '3.221,34'],
    ];
    const r = autoParse(rows);
    expect(r.txs).toHaveLength(4);
    expect(r.txs[0]).toEqual({ date: '2026-06-02', description: 'COMPRA CONTINENTE MATOSINHOS', amount: 45.67, type: 'expense' });
    expect(r.txs[1]!.type).toBe('income');
    expect(r.txs[1]!.amount).toBe(1800);
    expect(r.endingBalance).toBe(3221.34);
  });

  it('Millennium BCP — coluna "Valor" (não "Montante") + saldo', () => {
    const rows = [
      ['Data Lançamento', 'Data Valor', 'Descritivo', 'Valor', 'Saldo'],
      ['02-06-2026', '02-06-2026', 'PAGAMENTO MB WAY', '-30,00', '970,00'],
      ['05-06-2026', '05-06-2026', 'TRANSFERENCIA RECEBIDA', '500,00', '1.470,00'],
      ['09-06-2026', '09-06-2026', 'SPOTIFY', '-9,99', '1.460,01'],
      ['15-06-2026', '15-06-2026', 'LEVANTAMENTO ATM', '-60,00', '1.400,01'],
    ];
    const r = autoParse(rows);
    expect(r.txs.map((t) => t.type)).toEqual(['expense', 'income', 'expense', 'expense']);
    expect(r.txs[1]!.amount).toBe(500);
    expect(r.endingBalance).toBe(1400.01);
  });

  it('banco com colunas Débito/Crédito separadas + saldo', () => {
    const rows = [
      ['Data', 'Descrição', 'Débito', 'Crédito', 'Saldo'],
      ['01-06-2026', 'SUPERMERCADO PINGO DOCE', '50,00', '', '950,00'],
      ['02-06-2026', 'SALARIO', '', '1.200,00', '2.150,00'],
      ['03-06-2026', 'RENDA CASA', '600,00', '', '1.550,00'],
      ['04-06-2026', 'REEMBOLSO IRS', '', '150,00', '1.700,00'],
    ];
    const r = autoParse(rows);
    expect(r.txs.map((t) => t.type)).toEqual(['expense', 'income', 'expense', 'income']);
    expect(r.txs[0]!.amount).toBe(50);
    expect(r.txs[1]!.amount).toBe(1200);
    expect(r.endingBalance).toBe(1700);
  });

  it('Trading 212 — coluna "Action" decide o sentido; "Total" é o valor, "Price" é ruído', () => {
    const rows = [
      ['Action', 'Time', 'ISIN', 'Ticker', 'Name', 'No. of shares', 'Price / share', 'Currency (Price / share)', 'Total', 'Currency (Total)'],
      ['Deposit', '2026-06-01 10:00:00', '', '', '', '', '', '', '500.00', 'EUR'],
      ['Market buy', '2026-06-03 14:30:00', 'US0378331005', 'AAPL', 'Apple Inc', '2', '150.00', 'USD', '300.00', 'EUR'],
      ['Withdrawal', '2026-06-10 09:00:00', '', '', '', '', '', '', '200.00', 'EUR'],
      ['Dividend', '2026-06-15 12:00:00', 'US0378331005', 'AAPL', 'Apple Inc', '', '', '', '5.00', 'EUR'],
    ];
    const r = autoParse(rows);
    expect(r.txs).toHaveLength(4);
    expect(r.txs.map((t) => t.amount)).toEqual([500, 300, 200, 5]);
    expect(r.txs.map((t) => t.type)).toEqual(['income', 'expense', 'expense', 'income']);
  });

  it('Trade Republic (CSV de conta) — data, tipo e montante assinado', () => {
    const rows = [
      ['Date', 'Type', 'Description', 'Amount', 'Balance'],
      ['2026-06-02', 'Card', 'Lidl Lisboa', '-23,40', '976,60'],
      ['2026-06-05', 'Transfer', 'Salary', '1.500,00', '2.476,60'],
      ['2026-06-08', 'Card', 'Uber', '-8,90', '2.467,70'],
      ['2026-06-20', 'Interest', 'Interest payment', '3,12', '2.470,82'],
    ];
    const r = autoParse(rows);
    expect(r.txs.map((t) => t.type)).toEqual(['expense', 'income', 'expense', 'income']);
    expect(r.txs[1]!.amount).toBe(1500);
    expect(r.endingBalance).toBe(2470.82);
  });

  it('sem cabeçalho nenhum: infere só pelo conteúdo (data + montante assinado)', () => {
    const rows = [
      ['03/06/2026', 'Continente', '-31,20'],
      ['05/06/2026', 'Ordenado', '1.400,00'],
      ['07/06/2026', 'Farmacia', '-12,50'],
    ];
    const r = autoParse(rows);
    expect(r.txs.map((t) => t.type)).toEqual(['expense', 'income', 'expense']);
  });

  it('ignora preâmbulo e rodapé (linhas sem data ou sem valor)', () => {
    const rows = [
      ['Extrato de Conta à Ordem'],
      ['Cliente: 123456', 'IBAN PT50...'],
      ['Data', 'Descrição', 'Montante', 'Saldo'],
      ['02-06-2026', 'COMPRA', '-10,00', '990,00'],
      ['05-06-2026', 'DEPOSITO', '200,00', '1.190,00'],
      ['08-06-2026', 'CAFE', '-2,50', '1.187,50'],
      ['Total débitos: 12,50', '', '', ''],
    ];
    const r = autoParse(rows);
    expect(r.txs).toHaveLength(3);
    expect(r.endingBalance).toBe(1187.5);
  });

  it('Santander real — preâmbulo com aspas, 2 datas, colunas "Divisa" (EUR), montante com/sem símbolo', () => {
    const rows = [
      ['Conta:', '1234567890'],
      ['Periodo:', '01/05/2026 a 31/05/2026'],
      ['Fecha Operacao', 'Fecha Valor', 'Concepto', 'Importe', 'Divisa', 'Saldo', 'Divisa'],
      ['02/05/2026', '02/05/2026', 'COMPRA EL CORTE INGLES', '-45,67 EUR', 'EUR', '1.454,33', 'EUR'],
      ['05/05/2026', '05/05/2026', 'NOMINA MAIO', '1.800,00 EUR', 'EUR', '3.254,33', 'EUR'],
      ['10/05/2026', '10/05/2026', 'NETFLIX', '-12,99 EUR', 'EUR', '3.241,34', 'EUR'],
    ];
    const r = autoParse(rows);
    expect(r.txs).toHaveLength(3);
    expect(r.txs.map((t) => t.type)).toEqual(['expense', 'income', 'expense']);
    expect(r.txs[1]!.amount).toBe(1800);
    expect(r.txs[0]!.description).toBe('COMPRA EL CORTE INGLES');
    expect(r.endingBalance).toBe(3241.34);
  });

  it('recusa honesta quando não há sinal, saldo nem ação (só valores positivos)', () => {
    const rows = [
      ['Data', 'Descrição', 'Valor'],
      ['01-06-2026', 'Mercearia Alfa', '10,00'],
      ['02-06-2026', 'Loja Beta', '20,00'],
      ['03-06-2026', 'Quiosque Gama', '30,00'],
    ];
    expect(() => autoParse(rows)).toThrowError(IngestError);
  });

  it('integra no pipeline: ficheiro de banco desconhecido é lido (bank "outro")', () => {
    const csv = [
      'Data;Descrição;Montante;Saldo',
      '02-06-2026;COMPRA CONTINENTE;-45,00;955,00',
      '05-06-2026;ORDENADO;1500,00;2455,00',
      '10-06-2026;NETFLIX;-13,00;2442,00',
    ].join('\n');
    const res = ingestStatement(toBytes(csv));
    expect(res.bank).toBe('outro');
    expect(res.summary.transactions.length).toBe(3);
    expect(res.summary.income).toBe(1500);
  });
});
