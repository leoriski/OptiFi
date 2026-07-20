/**
 * Descodifica bytes de um extrato para texto. Os bancos portugueses mais
 * antigos (CGD, Millennium) exportam em Windows-1252/Latin-1; os modernos
 * (Revolut, N26) em UTF-8. Tenta UTF-8 estrito primeiro; se falhar, cai
 * para Windows-1252 (que nunca falha — todos os bytes são válidos).
 */
export function decodeStatementText(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Remove BOM se presente
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
