import { NextResponse } from 'next/server';
import { financeWrites } from '@optifi/data';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * POST /api/reanalyze — volta a categorizar os extratos JÁ importados com as
 * regras atuais e recalcula os totais.
 *
 * Como em `/api/categorize`, a rota só trata da autenticação e do limite de
 * pedidos: o trabalho está no `@optifi/data`, partilhado com a app nativa.
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

  try {
    const { imports, changed } = await financeWrites(supabase).reanalyze();
    return NextResponse.json({ ok: true, imports, changed });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}
