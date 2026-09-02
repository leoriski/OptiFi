import { afterEach, describe, expect, it } from 'vitest';
import { decodeStatementText } from '../src/text.js';

const bytes = (...b: number[]) => new Uint8Array(b);
const utf8 = (s: string) => new TextEncoder().encode(s);

const realTextDecoder = globalThis.TextDecoder;
afterEach(() => {
  globalThis.TextDecoder = realTextDecoder;
});

/**
 * O Hermes (telemóvel) só conhece o rótulo 'utf-8' e devolve U+FFFD em vez de
 * lançar quando os bytes não são válidos. Este duplo reproduz esse motor para
 * que o caminho manual de Windows-1252 seja mesmo exercitado nos testes — no
 * Node ele nunca correria, e a regressão só apareceria no telemóvel.
 */
function useHermesTextDecoder() {
  globalThis.TextDecoder = class {
    constructor(label = 'utf-8') {
      if (label !== 'utf-8') throw new RangeError(`unsupported encoding: ${label}`);
    }
    decode(input: Uint8Array) {
      return new realTextDecoder('utf-8').decode(input); // sem `fatal`: substitui em silêncio
    }
  } as unknown as typeof TextDecoder;
}

describe('decodeStatementText', () => {
  it('lê UTF-8 e descarta o BOM', () => {
    expect(decodeStatementText(utf8('\uFEFFData;Descrição'))).toBe('Data;Descrição');
  });

  it('lê Windows-1252 quando os bytes não são UTF-8 válido', () => {
    // 'Manutenção' com ç (0xE7) e ã (0xE3) em Windows-1252
    expect(decodeStatementText(bytes(0x4d, 0x61, 0x6e, 0x75, 0x74, 0x65, 0x6e, 0xe7, 0xe3, 0x6f))).toBe('Manutenção');
  });

  it('lê o intervalo 0x80–0x9F que distingue Windows-1252 de Latin-1', () => {
    expect(decodeStatementText(bytes(0x80, 0x91, 0x92, 0x96))).toBe('€‘’–');
  });

  describe('num motor sem Windows-1252 (Hermes)', () => {
    it('continua a ler UTF-8', () => {
      useHermesTextDecoder();
      expect(decodeStatementText(utf8('Descrição'))).toBe('Descrição');
    });

    it('cai no descodificador manual em vez de devolver caracteres partidos', () => {
      useHermesTextDecoder();
      expect(decodeStatementText(bytes(0x4d, 0x61, 0x6e, 0x75, 0x74, 0x65, 0x6e, 0xe7, 0xe3, 0x6f))).toBe('Manutenção');
      expect(decodeStatementText(bytes(0x80, 0x91, 0x92, 0x96))).toBe('€‘’–');
    });
  });

  it('sobrevive a não haver TextDecoder nenhum', () => {
    globalThis.TextDecoder = undefined as unknown as typeof TextDecoder;
    expect(decodeStatementText(bytes(0x53, 0x61, 0x6c, 0x64, 0x6f))).toBe('Saldo');
  });
});
