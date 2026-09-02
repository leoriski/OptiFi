import { getDocumentProxy } from 'unpdf';
import { rebuildPdfLines, type TextFragment } from '@optifi/ingest';

/**
 * Extrai o texto de um extrato PDF reconstruindo as LINHAS visuais: o pdf.js
 * devolve fragmentos soltos com coordenadas; a reconstrução (agrupar por Y com
 * tolerância, ordenar por X) vive no `@optifi/ingest`, partilhado com a app
 * móvel. O ficheiro nunca é guardado (minimização RGPD): bytes → linhas → descartado.
 */
export async function extractPdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const pages: { items: TextFragment[] }[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items: TextFragment[] = [];
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      items.push({ x: item.transform[4] as number, y: item.transform[5] as number, str: item.str });
    }
    pages.push({ items });
  }

  return rebuildPdfLines(pages);
}