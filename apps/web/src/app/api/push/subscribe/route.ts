import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Guarda (ou apaga) a subscrição de push do utilizador autenticado. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { endpoint?: string; p256dh?: string; auth?: string };
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  // upsert por endpoint — o mesmo browser não cria duplicados.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) {
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', body.endpoint);
  }
  return NextResponse.json({ ok: true });
}
