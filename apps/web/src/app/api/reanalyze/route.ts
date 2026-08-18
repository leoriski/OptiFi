import { NextResponse } from 'next/server';
import { categorizeStatement, groupSubscriptions } from '@optifi/ingest';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * POST /api/reanalyze — volta a categorizar os extratos JÁ importados com as
 * regras atuais e recalcula os totais.
 *
 * A categoria é decidida na importação e fica gravada; sem isto, melhorias no
 * motor (ex.: passar a reconhecer transferências entre pessoas) só apanhariam
 * importações novas e quem já usa a app continuaria a ver análises erradas.
 * Corre sobre o descritivo guardado — não precisa do ficheiro original, que
 * nunca chegámos a guardar.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!rateLimit(`reanalyze:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { data: imports, error: impErr } = await supabase
    .from('imports')
    .select('id,statement_month')
    .eq('user_id', user.id);
  if (impErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  if (!imports || imports.length === 0) return NextResponse.json({ ok: true, changed: 0, imports: 0 });

  let changed = 0;

  for (const imp of imports) {
    const { data: rows, error: txErr } = await supabase
      .from('transactions')
      .select('id,tx_date,description,amount,tx_type,category')
      .eq('user_id', user.id)
      .eq('import_id', imp.id);
    if (txErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });
    if (!rows || rows.length === 0) continue;

    const recategorized = categorizeStatement(
      rows.map((r) => ({ id: r.id, date: r.tx_date, description: r.description, amount: Number(r.amount), type: r.tx_type, was: r.category })),
    );

    for (const tx of recategorized) {
      if (tx.category === tx.was) continue;
      const { error } = await supabase.from('transactions').update({ category: tx.category }).eq('id', tx.id);
      if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
      changed++;
    }

    // Os totais do mês derivam das categorias: transferências ficam de fora.
    let income = 0;
    let expenses = 0;
    let housingFixed = 0;
    for (const tx of recategorized) {
      if (tx.category === 'transferencias') continue;
      if (tx.type === 'income') income += tx.amount;
      else {
        expenses += tx.amount;
        if (tx.category === 'habitacao') housingFixed += tx.amount;
      }
    }
    const { error: updErr } = await supabase
      .from('imports')
      .update({ income: round2(income), expenses: round2(expenses), housing_fixed: round2(housingFixed) })
      .eq('id', imp.id);
    if (updErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });

    // Subscrições detetadas: recria a lista deste import preservando o
    // veredicto ("uso"/"não uso") que o utilizador já tinha dado ao serviço.
    const { data: oldSubs } = await supabase
      .from('subscriptions')
      .select('name,user_status')
      .eq('user_id', user.id);
    const verdictByName = new Map((oldSubs ?? []).map((s) => [s.name.toLowerCase(), s.user_status]));

    // Mesmo agrupamento da importação: um serviço = uma linha.
    const grouped = groupSubscriptions(recategorized);
    await supabase.from('subscriptions').delete().eq('user_id', user.id).eq('import_id', imp.id);
    if (grouped.length > 0) {
      const { error: subErr } = await supabase.from('subscriptions').insert(
        grouped.map((s) => ({
          user_id: user.id,
          import_id: imp.id,
          name: s.name,
          price: s.price,
          user_status: verdictByName.get(s.name.toLowerCase()) ?? 'unknown',
        })),
      );
      if (subErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, imports: imports.length, changed });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
