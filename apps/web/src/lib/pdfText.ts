import { getDocumentProxy } from 'unpdf';

/**
 * Extrai o texto de um extrato PDF reconstruindo as LINHAS visuais: o pdf.js
 * devolve fragmentos soltos com coordenadas; agrupamos por Y (com tolerância,
 * topo→fundo) e ordenamos por X, para que cada linha volte a ser
 * "data · descritivo · montante · saldo" — o formato que o parser espera.
 * O ficheiro nunca é guardado (minimização RGPD): bytes → linhas → descartado.
 */
export async function extractPdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const lines: string[] = [];
  const Y_TOLERANCE = 3; // pontos: fragmentos a <3pt de altura são a mesma linha

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const fragments: { x: number; y: number; str: string }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      fragments.push({ x: item.transform[4] as number, y: item.transform[5] as number, str: item.str });
    }
    // Agrupa por Y com tolerância (as linhas de tabela variam fracções de pt).
    fragments.sort((a, b) => b.y - a.y || a.x - b.x);
    let current: { y: number; parts: { x: number; str: string }[] } | null = null;
    const rows: { x: number; str: string }[][] = [];
    for (const f of fragments) {
      if (current === null || Math.abs(current.y - f.y) > Y_TOLERANCE) {
        current = { y: f.y, parts: [] };
        rows.push(current.parts);
      }
      current.parts.push({ x: f.x, str: f.str });
    }
    for (const parts of rows) {
      lines.push(parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim());
    }
  }
  return lines;
}
