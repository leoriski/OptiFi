// Reconstrução de linhas de um PDF a partir dos fragmentos de texto com
// coordenadas (a saída do pdf.js à la `getTextContent`). Puro e sem
// dependências de ambiente: a extração dos fragmentos vive em cada app (web
// usa `unpdf`, mobile usa `pdfjs-dist`), mas o modo como se juntam em LINHAS
// visuais é partilhado e testável — cada linha volta a ser
// "data · descritivo · montante · saldo", o formato que o parser espera.

export interface TextFragment {
  x: number;
  y: number;
  str: string;
}

export interface PdfPageText {
  items: TextFragment[];
}

/** Tolerância em pontos: fragmentos a <3pt de altura são a mesma linha. */
const Y_TOLERANCE = 3;

/**
 * Agrupa os fragmentos por Y (com tolerância, topo→fundo) e ordena por X
 * dentro de cada linha. Devolve as linhas já limpas (espaços colapsados).
 */
export function rebuildPdfLines(pages: PdfPageText[]): string[] {
  const lines: string[] = [];
  for (const page of pages) {
    const fragments = page.items.filter((f) => f.str.trim() !== '');
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