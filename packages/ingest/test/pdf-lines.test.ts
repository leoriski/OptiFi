import { describe, it, expect } from 'vitest';
import { rebuildPdfLines, parsePdfStatementLines } from '../src/index.js';

describe('rebuildPdfLines — fragmentos soltos voltam a ser linhas visuais', () => {
  it('reconstrói uma linha por ordem de X mesmo com Y a variar <3pt', () => {
    const pages = [
      {
        items: [
          { x: 300, y: 200, str: '199.92' },
          { x: 20, y: 202, str: '6.01' },
          { x: 420, y: 201, str: '935.44' },
          { x: 90, y: 200.5, str: 'TRF MB WAY P/ CARLA' },
        ],
      },
    ];
    expect(rebuildPdfLines(pages)).toEqual(['6.01 TRF MB WAY P/ CARLA 199.92 935.44']);
  });

  it('separa em linhas quando o Y difere mais que a tolerância (topo→fundo)', () => {
    const pages = [
      {
        items: [
          { x: 20, y: 40, str: 'SALDO INICIAL' },
          { x: 80, y: 40, str: '1 135.36' },
          { x: 20, y: 10, str: '6.01' },
        ],
      },
    ];
    expect(rebuildPdfLines(pages)).toEqual(['SALDO INICIAL 1 135.36', '6.01']);
  });

  it('descarta fragmentos vazios e colapsa espaços', () => {
    const pages = [{ items: [{ x: 0, y: 0, str: '  ' }, { x: 5, y: 0, str: 'a' }, { x: 10, y: 0, str: '  b  ' }] }];
    expect(rebuildPdfLines(pages)).toEqual(['a b']);
  });

  it('mantém a ordem entre páginas e ignora páginas sem texto', () => {
    const pages = [
      { items: [{ x: 0, y: 30, str: 'p1' }] },
      { items: [] },
      { items: [{ x: 0, y: 30, str: 'p3' }] },
    ];
    expect(rebuildPdfLines(pages)).toEqual(['p1', 'p3']);
  });

  it('entrega ao parser o mesmo tipo de linhas que os extratos reais', () => {
    const line = (str: string, x: number, y = 20) => ({ x, y, str });
    const pages = [
      {
        items: [
          line('SALDO INICIAL', 10, 40),
          line('1 135.36', 120, 40),
          line('6.01', 10),
          line('TRF MB WAY P/ CARLA ALEXANDRA VUMI MIRANDA', 80),
          line('199.92', 260),
          line('935.44', 320),
          line('6.03', 10, 0),
          line('IMPOSTO DO SELO', 80, 0),
          line('0.02', 260, 0),
          line('935.42', 320, 0),
        ],
      },
    ];
    const r = parsePdfStatementLines(rebuildPdfLines(pages));
    expect(r.txs).toHaveLength(2);
    expect(r.txs[0]).toMatchObject({ date: '2026-06-01', amount: 199.92, type: 'expense' });
    expect(r.txs[1]).toMatchObject({ date: '2026-06-03', amount: 0.02, type: 'expense' });
  });
});