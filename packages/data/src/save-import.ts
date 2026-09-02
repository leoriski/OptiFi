import { applyCategoryRules, toRuleMap } from '@optifi/core';
import { summariseTotals, type StatementSummary } from '@optifi/ingest';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SaveImportResult {
  statementMonth: string;
  txCount: number;
  income: number;
  expenses: number;
  subscriptions: number;
}

export class SaveImportError extends Error {
  constructor(public code: 'db_error') {
    super(code);
    this.name = 'SaveImportError';
  }
}

/**
 * Grava um extrato já parseado: o mês fechado, os movimentos e as subscrições
 * detetadas. Vive aqui e não em cada app porque as regras que a seguir se
 * aplicam (preservar categorias corrigidas, preservar veredictos de
 * subscrições, substituir um mês reimportado sem deixar órfãos) são
 * invisíveis a olho nu — se o telemóvel tivesse a sua própria cópia, a
 * primeira a divergir apagaria trabalho do utilizador sem ninguém dar por isso.
 *
 * Escreve com o cliente do PRÓPRIO utilizador: tudo passa pelo RLS, não há
 * chave de serviço, e por isso corre igualmente bem num servidor ou no
 * aparelho.
 */
export async function saveImport(
  supabase: SupabaseClient,
  userId: string,
  bank: string,
  parsed: StatementSummary,
): Promise<SaveImportResult> {
  const fail = (): never => {
    throw new SaveImportError('db_error');
  };

  // Correções que o utilizador já fez a estes comerciantes. Uma reimportação
  // cria linhas NOVAS (fingerprint novo, import novo), por isso sem as regras
  // o trabalho de arrumação do mês anterior desaparecia sempre que ele
  // voltasse a carregar o extrato. Os totais são refeitos a seguir porque as
  // categorias mudaram: uma transferência sai das despesas.
  const { data: ruleRows } = await supabase.from('category_rules').select('merchant,category').eq('user_id', userId);
  const transactions = applyCategoryRules(parsed.transactions, toRuleMap(ruleRows));
  const summary = { ...parsed, transactions, ...summariseTotals(transactions) };

  // Preserva veredictos dados a subscrições com o mesmo nome (reimportação
  // não pode apagar decisões do utilizador).
  const { data: oldSubs } = await supabase.from('subscriptions').select('name,user_status').eq('user_id', userId);
  const verdictByName = new Map((oldSubs ?? []).map((s) => [s.name.toLowerCase(), s.user_status]));

  // Reimportar o mesmo mês substitui a análise anterior. As transações caem
  // por cascade; as subscrições do import antigo têm de ser apagadas
  // EXPLICITAMENTE (o FK usa SET NULL — deixá-las órfãs fá-las-ia passar por
  // subscrições manuais e duplicar a cada reimportação).
  const { data: oldImports } = await supabase
    .from('imports')
    .select('id')
    .eq('user_id', userId)
    .eq('statement_month', summary.statementMonth);
  for (const old of oldImports ?? []) {
    await supabase.from('subscriptions').delete().eq('import_id', old.id);
  }
  const { error: delErr } = await supabase
    .from('imports')
    .delete()
    .eq('user_id', userId)
    .eq('statement_month', summary.statementMonth);
  if (delErr) fail();

  const importRow: Record<string, unknown> = {
    user_id: userId,
    bank,
    statement_month: summary.statementMonth,
    status: 'ready',
    income: summary.income,
    expenses: summary.expenses,
    housing_fixed: summary.housingFixed,
    base_leak: 0, // as fugas nascem da análise
  };
  if (summary.endingBalance !== undefined) importRow.ending_balance = summary.endingBalance;

  const inserted = await supabase.from('imports').insert(importRow).select('id').single();
  let importId: string;
  if (inserted.error && summary.endingBalance !== undefined) {
    // Coluna ending_balance ainda não existe (migração 0004 por correr):
    // grava sem ela em vez de falhar.
    delete importRow.ending_balance;
    const retry = await supabase.from('imports').insert(importRow).select('id').single();
    if (retry.error || !retry.data) fail();
    importId = retry.data!.id as string;
  } else if (inserted.error || !inserted.data) {
    return fail();
  } else {
    importId = inserted.data.id as string;
  }

  const txRows = summary.transactions.map((t) => ({
    user_id: userId,
    import_id: importId,
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
  if (txErr) fail();

  // Substitui as subscrições detetadas neste import, preservando veredictos.
  await supabase.from('subscriptions').delete().eq('user_id', userId).eq('import_id', importId);
  if (summary.subscriptions.length > 0) {
    const subRows = summary.subscriptions.map((s) => ({
      user_id: userId,
      import_id: importId,
      name: s.name,
      price: s.price,
      user_status: verdictByName.get(s.name.toLowerCase()) ?? 'unknown',
    }));
    const { error: subErr } = await supabase.from('subscriptions').insert(subRows);
    if (subErr) fail();
  }

  return {
    statementMonth: summary.statementMonth,
    txCount: summary.transactions.length,
    income: summary.income,
    expenses: summary.expenses,
    subscriptions: summary.subscriptions.length,
  };
}
