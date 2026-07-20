/**
 * Parser CSV tolerante, sem dependências: deteta o delimitador (vírgula,
 * ponto-e-vírgula ou tab), respeita campos entre aspas (RFC 4180, incluindo
 * aspas escapadas e quebras de linha dentro de aspas) e aceita CRLF.
 */

export function sniffDelimiter(text: string): ',' | ';' | '\t' {
  // Conta candidatos fora de aspas nas primeiras linhas não vazias.
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  let lines = 0;
  for (let i = 0; i < text.length && lines < 10; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ',') counts[',']++;
      else if (ch === ';') counts[';']++;
      else if (ch === '\t') counts['\t']++;
      else if (ch === '\n') lines++;
    }
  }
  // Ponto-e-vírgula ganha empates: é o delimitador típico dos bancos PT,
  // onde a vírgula aparece dentro dos valores ('1.234,56').
  if (counts[';'] > 0 && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[',']) return '\t';
  return ',';
}

export function parseCsv(text: string, delimiter?: ',' | ';' | '\t'): string[][] {
  const delim = delimiter ?? sniffDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // Ignora linhas totalmente vazias
    if (row.length > 1 || (row[0] ?? '').trim() !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}
