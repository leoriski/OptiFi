/**
 * Os 32 bytes (0x80–0x9F) em que o Windows-1252 difere do Latin-1. Fora deste
 * intervalo os dois são iguais e o byte vale pelo próprio code point.
 * `\uFFFD` marca as quatro posições que a norma deixa por atribuir.
 */
const CP1252_HIGH = '€\uFFFD‚ƒ„…†‡ˆ‰Š‹Œ\uFFFDŽ\uFFFD\uFFFD‘’“”•–—˜™š›œ\uFFFDžŸ';

/**
 * Descodifica Windows-1252 à mão, sem `TextDecoder`: o do Hermes (telemóvel)
 * só conhece utf-8 e rebenta com qualquer outro rótulo, por isso não se pode
 * depender dele para o acento de um extrato da CGD.
 */
function decodeCp1252(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : String.fromCharCode(b);
  }
  return out;
}

/** Descodifica como UTF-8, ou devolve null se os bytes não forem UTF-8 válido. */
function tryUtf8(bytes: Uint8Array): string | null {
  if (typeof TextDecoder === 'undefined') return null;
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  // O `fatal` não é honrado em todos os motores (o Hermes devolve U+FFFD em
  // vez de lançar). Um extrato legítimo nunca traz o caractere de
  // substituição, por isso encontrá-lo significa que estes bytes não são
  // UTF-8 — e o Windows-1252 é que os vai ler bem.
  return text.includes('\uFFFD') ? null : text;
}

/**
 * Descodifica bytes de um extrato para texto. Os bancos portugueses mais
 * antigos (CGD, Millennium) exportam em Windows-1252/Latin-1; os modernos
 * (Revolut, N26) em UTF-8. Tenta UTF-8 primeiro; se falhar, cai para
 * Windows-1252 (que nunca falha — todos os bytes são válidos).
 */
export function decodeStatementText(bytes: Uint8Array): string {
  const utf8 = tryUtf8(bytes);
  if (utf8 === null) return decodeCp1252(bytes);
  // Remove BOM se presente
  return utf8.charCodeAt(0) === 0xfeff ? utf8.slice(1) : utf8;
}
