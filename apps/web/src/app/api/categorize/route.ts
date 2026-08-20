import { NextResponse } from 'next/server';
import { summariseTotals } from '@optifi/ingest';
import type { CategoryKey } from '@optifi/core';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { isCategoryKey, merchantKey } from '@/lib/server/categoryRules';

export const runtime = 'nodejs';

/**
 * POST /api/categorize — o utilizador diz a que categoria pertence um
 * comerciante. Recebe { merchant, category }.
 *
 * Faz-se tudo aqui e não no cliente porque a decisão tem três consequências
 * que têm de acontecer juntas ou nenhuma: fica a REGRA (para a próxima
 * importação e para o Re-analisar não a apagarem), mudam as LINHAS já
 * importadas com esse nome, e mudam os TOTAIS do mês. O último é o que passa
 * despercebido: marcar um movimento como transferência tira-o das despesas, e
 * a análise inteira — défice, taxa de poupança, regra 50/30/20 — assenta
 * nesses totais.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Generoso de propósito: arrumar um extrato são dezenas de decisões seguidas,
  // e ficar bloqueado a meio seria pior do que o problema que isto resolve.
  if (!rateLimit(`categorize:${user.id}`, 300, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: { merchant?: unknown; category?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const merchant = typeof body.merchant === 'string' ? body.merchant.trim() : '';
  if (merchant === '' || merchant.length > 64) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  if (!isCategoryKey(body.category)) return NextResponse.json({ error: 'bad_category' }, { status: 400 });
  const category: CategoryKey = body.category;

  const { error: ruleErr } = await supabase
    .from('category_rules')
    .upsert({ user_id: user.id, merchant, category }, { onConflict: 'user_id,merchant' });
  if (ruleErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });

  // Todas as transações do utilizador, de todos os meses: uma regra criada hoje
  // vale para o extrato de janeiro tanto como para o de agosto.
  const { data: rows, error: txErr } = await supabase
    .from('transactions')
    .select('id,import_id,description,category,amount,tx_type')
    .eq('user_id', user.id);
  if (txErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });

  const all = (rows ?? []).map((r) => ({
    id: r.id as string,
    importId: r.import_id as string,
    category: r.category as CategoryKey,
    amount: Number(r.amount),
    type: r.tx_type as 'income' | 'expense',
    matches: merchantKey(r.description as string) === merchant,
  }));

  const changed = all.filter((r) => r.matches && r.category !== category);
  if (changed.length > 0) {
    const { error } = await supabase
      .from('transactions')
      .update({ category })
      .in(
        'id',
        changed.map((r) => r.id),
      );
    if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
    for (const r of changed) r.category = category;
  }

  // Só os meses que mudaram mesmo — poupa escritas e evita mexer em imports
  // que esta decisão não tocou.
  const affected = new Set(changed.map((r) => r.importId));
  for (const importId of affected) {
    const totals = summariseTotals(all.filter((r) => r.importId === importId));
    const { error } = await supabase
      .from('imports')
      .update({ income: totals.income, expenses: totals.expenses, housing_fixed: totals.housingFixed })
      .eq('id', importId);
    if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, merchant, category, changed: changed.length });
}
