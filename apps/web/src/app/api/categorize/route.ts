import { NextResponse } from 'next/server';
import { isCategoryKey, type CategoryKey } from '@optifi/core';
import { financeWrites } from '@optifi/data';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * POST /api/categorize — o utilizador diz a que categoria pertence um
 * comerciante. Recebe { merchant, category }.
 *
 * A rota só faz o que é do servidor (autenticação e limite de pedidos). A
 * decisão em si — gravar a regra, mudar as linhas já importadas e refazer os
 * totais do mês — vive no `@optifi/data`, que é de onde a app nativa também a
 * chama; duas cópias das mesmas regras acabariam por divergir.
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

  try {
    const changed = await financeWrites(supabase).setTxCategory(merchant, category);
    return NextResponse.json({ ok: true, merchant, category, changed });
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}
