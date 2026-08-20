import { NextResponse, type NextRequest } from 'next/server';
import { buildStatement, ingestStatement, parsePdfStatementLines, pdfContentStart, summariseTotals, IngestError, type BankId, type ColumnMapping } from '@optifi/ingest';
import { createClient } from '@/lib/supabase/server';
import { extractPdfLines } from '@/lib/pdfText';
import { rateLimit } from '@/lib/rateLimit';
import { applyCategoryRules, toRuleMap } from '@/lib/server/categoryRules';

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

  // Correções que o utilizador já fez a estes comerciantes. Uma reimportação
  // cria linhas NOVAS (fingerprint novo, import novo), por isso sem as regras
  // o trabalho de arrumação do mês anterior desaparecia sempre que ele
  // voltasse a carregar o extrato — que é exatamente o que vai ter de fazer
  // para corrigir as datas. Os totais são refeitos a seguir porque as
  // categorias mudaram: uma transferência sai das despesas.
  const { data: ruleRows } = await supabase.from('category_rules').select('merchant,category').eq('user_id', user.id);
  const transactions = applyCategoryRules(result.summary.transactions, toRuleMap(ruleRows));
  const summary = { ...result.summary, transactions, ...summariseTotals(transactions) };

  // Preserva veredictos dados a subscrições com o mesmo nome (reimportação
  // não pode apagar decisões do utilizador).
  const { data: oldSubs } = await supabase
    .from('subscriptions')
    .select('name,user_status')
    .eq('user_id', user.id);
  const verdictByName = new Map((oldSubs ?? []).map((s) => [s.name.toLowerCase(), s.user_status]));

  // Reimportar o mesmo mês substitui a análise anterior. As transações caem
  // por cascade; as subscrições do import antigo têm de ser apagadas
  // EXPLICITAMENTE (o FK usa SET NULL — deixá-las órfãs fá-las-ia passar por
  // subscrições manuais e duplicar a cada reimportação).
  const { data: oldImports } = await supabase
    .from('imports')
    .select('id')
    .eq('user_id', user.id)
    .eq('statement_month', summary.statementMonth);
  for (const old of oldImports ?? []) {
    await supabase.from('subscriptions').delete().eq('import_id', old.id);
  }
  const { error: delErr } = await supabase
    .from('imports')
    .delete()
    .eq('user_id', user.id)
    .eq('statement_month', summary.statementMonth);
  if (delErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });

  const importRow: Record<string, unknown> = {
    user_id: user.id,
    bank,
    statement_month: summary.statementMonth,
    status: 'ready',
    income: summary.income,
    expenses: summary.expenses,
    housing_fixed: summary.housingFixed,
    base_leak: 0, // as fugas nascem da análise (Fase 3)
  };
  if (summary.endingBalance !== undefined) importRow.ending_balance = summary.endingBalance;

  let imported: { id: string } | null = null;
  {
    const { data, error: impErr } = await supabase.from('imports').insert(importRow).select('id').single();
    if (impErr && summary.endingBalance !== undefined) {
      // Coluna ending_balance ainda não existe (migração 0004 por correr):
      // grava sem ela em vez de falhar.
      delete importRow.ending_balance;
      const retry = await supabase.from('imports').insert(importRow).select('id').single();
      if (retry.error || !retry.data) return NextResponse.json({ error: 'db_error' }, { status: 500 });
      imported = retry.data;
    } else if (impErr || !data) {
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    } else {
      imported = data;
    }
  }


  const txRows = summary.transactions.map((t) => ({
    user_id: user.id,
    import_id: imported.id,
    tx_date: t.date,
    description: t.description,
    amount: t.amount,
    tx_type: t.type,
    category: t.category,
    fingerprint: t.fingerprint,
  }));
  const { error: txErr } = await supabase
    .from('transactions')
    .upsert(txRows, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true });
  if (txErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });

  // Substitui as subscrições detetadas neste import, preservando veredictos
  await supabase.from('subscriptions').delete().eq('user_id', user.id).eq('import_id', imported.id);
  if (summary.subscriptions.length > 0) {
    const subRows = summary.subscriptions.map((s) => ({
      user_id: user.id,
      import_id: imported.id,
      name: s.name,
      price: s.price,
      user_status: verdictByName.get(s.name.toLowerCase()) ?? 'unknown',
    }));
    const { error: subErr } = await supabase.from('subscriptions').insert(subRows);
    if (subErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    bank,
    statementMonth: summary.statementMonth,
    txCount: summary.transactions.length,
    income: summary.income,
    expenses: summary.expenses,
    subscriptions: summary.subscriptions.length,
  });
}
