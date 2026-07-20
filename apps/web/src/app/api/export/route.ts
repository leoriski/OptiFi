import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/export — portabilidade de dados (RGPD, art. 20.º): devolve todos
 * os dados do utilizador num único JSON descarregável.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tables = [
    'profiles',
    'imports',
    'transactions',
    'subscriptions',
    'goals',
    'goal_withdrawals',
    'category_limits',
    'manual_entries',
    'plan_items',
  ] as const;

  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
  };
  for (const table of tables) {
    const { data: rows, error } = await supabase.from(table).select('*');
    data[table] = error ? { error: error.message } : rows;
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="optifi-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
