import { NextResponse, type NextRequest } from 'next/server';
import { buildStatement, ingestStatement, parsePdfStatementLines, pdfContentStart, IngestError, type BankId, type ColumnMapping } from '@optifi/ingest';
import { saveImport, SaveImportError } from '@optifi/data';
import { createClient } from '@/lib/supabase/server';
import { extractPdfLines } from '@/lib/pdfText';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 8 * 1024 * 1024; // extratos mensais são pequenos; PDFs pesam mais que CSVs
const VALID_BANKS = new Set(['revolut', 'cgd', 'bcp']);

/**
 * POST /api/import — recebe o CSV do extrato, parseia no servidor e grava
 * o mês fechado (import + transações + subscrições detetadas).
 * O ficheiro original nunca é guardado (minimização RGPD): entra, é
 * normalizado, e apenas os movimentos estruturados persistem.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 20 importações por hora por utilizador chega para qualquer uso legítimo.
  if (!rateLimit(`import:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file_size' }, { status: 400 });
  }

  const bankRaw = form.get('bank');
  const bankHint = typeof bankRaw === 'string' && VALID_BANKS.has(bankRaw) ? (bankRaw as BankId) : undefined;

  let mapping: ColumnMapping | undefined;
  const mappingRaw = form.get('mapping');
  if (typeof mappingRaw === 'string' && mappingRaw !== '') {
    try {
      const m = JSON.parse(mappingRaw) as ColumnMapping;
      if (
        typeof m.headerRow !== 'number' ||
        typeof m.dateCol !== 'number' ||
        typeof m.descriptionCol !== 'number'
      ) {
        return NextResponse.json({ error: 'bad_mapping' }, { status: 400 });
      }
      mapping = m;
    } catch {
      return NextResponse.json({ error: 'bad_mapping' }, { status: 400 });
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const pdfAt = pdfContentStart(bytes);

  let result;
  try {
    if (pdfAt >= 0) {
      // PDF: corta qualquer lixo antes do '%PDF', extrai as linhas visuais e
      // entrega ao parser. (PDFs cifrados/digitalizados falham → pdf_unreadable.)
      const pdfBytes = pdfAt === 0 ? bytes : bytes.slice(pdfAt);
      let pdfLines: string[];
      try {
        pdfLines = await extractPdfLines(pdfBytes);
      } catch {
        return NextResponse.json({ error: 'pdf_unreadable' }, { status: 422 });
      }
      const parsed = parsePdfStatementLines(pdfLines);
      result = { bank: 'outro' as const, summary: buildStatement(parsed.txs, parsed.endingBalance) };
    } else {
      result = ingestStatement(bytes, mapping ? { mapping } : bankHint ? { bankHint } : {});
    }
  } catch (e) {
    if (e instanceof IngestError) {
      return NextResponse.json({ error: e.code }, { status: 422 });
    }
    return NextResponse.json({ error: 'parse_failed' }, { status: 422 });
  }

  const { bank } = result;

  try {
    const saved = await saveImport(supabase, user.id, bank, result.summary);
    return NextResponse.json({ ok: true, bank, ...saved });
  } catch (e) {
    if (e instanceof SaveImportError) return NextResponse.json({ error: e.code }, { status: 500 });
    throw e;
  }
}
