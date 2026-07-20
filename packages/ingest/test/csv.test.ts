import { describe, it, expect } from 'vitest';
import { parseCsv, sniffDelimiter, parseEuroAmount, parseStatementDate, decodeStatementText } from '../src/index.js';

describe('delimiter sniffing', () => {
  it('deteta vírgula (Revolut), ponto-e-vírgula (bancos PT) e tab', () => {
    expect(sniffDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(sniffDelimiter('a;b;c\n1,50;2,00;3')).toBe(';');
    expect(sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('ponto-e-vírgula ganha quando os valores têm vírgulas decimais', () => {
    expect(sniffDelimiter('Data;Valor\n02-05-2026;1.234,56')).toBe(';');
  });
});

describe('parseCsv', () => {
  it('respeita campos entre aspas com delimitadores e aspas escapadas', () => {
    const rows = parseCsv('a,"x, y","com ""aspas"""\n1,2,3');
    expect(rows[0]).toEqual(['a', 'x, y', 'com "aspas"']);
  });

  it('aceita CRLF e ignora linhas vazias', () => {
    const rows = parseCsv('a,b\r\n\r\n1,2\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseEuroAmount — formatos dos bancos PT', () => {
  it.each([
    ['12,99', 12.99],
    ['1.234,56', 1234.56],
    ['1 234,56', 1234.56],
    ['-12.99', -12.99],
    ['1,234.56', 1234.56],
    ['€ 46,33', 46.33],
    ['(60,00)', -60],
    ['+850.00', 850],
    ['-45,67 EUR', -45.67], // sufixo de código de moeda (real em vários bancos)
    ['45,67EUR', 45.67], // colado, sem espaço
    ['EUR 1.800,00', 1800], // moeda à frente
    ['$12.00', 12], // símbolo de dólar
    ['8 765,44', 8765.44], // NBSP nos milhares
  ])('%s → %d', (raw, expected) => {
    expect(parseEuroAmount(raw)).toBeCloseTo(expected, 2);
  });

  it('devolve NaN para lixo', () => {
    expect(parseEuroAmount('')).toBeNaN();
    expect(parseEuroAmount('Saldo final')).toBeNaN();
  });
});

describe('parseStatementDate — sempre dia-primeiro em formatos PT', () => {
  it.each([
    ['2026-05-03 10:02:11', '2026-05-03'],
    ['02-05-2026', '2026-05-02'],
    ['02/05/2026', '2026-05-02'],
    ['2.5.2026', '2026-05-02'], // dia/mês sem zero à esquerda, com pontos
    ['31-02-2026', null], // data impossível
    ['Saldo', null],
  ])('%s → %s', (raw, expected) => {
    expect(parseStatementDate(raw)).toBe(expected);
  });
});

describe('decodeStatementText', () => {
  it('UTF-8 com BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x6f, 0x6c, 0xc3, 0xa1]); // BOM + 'olá'
    expect(decodeStatementText(bytes)).toBe('olá');
  });

  it('Windows-1252 (Descrição da CGD) não é mutilado', () => {
    // 'Descrição' em Windows-1252: ç=0xE7, ã=0xE3 — inválido como UTF-8
    const bytes = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0xe7, 0xe3, 0x6f]);
    expect(decodeStatementText(bytes)).toBe('Descrição');
  });
});
