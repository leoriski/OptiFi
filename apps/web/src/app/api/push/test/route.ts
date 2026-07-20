import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPush, pushConfigured } from '@/lib/server/webpush';

export const runtime = 'nodejs';

/** Envia uma notificação de teste ao próprio utilizador (para validar o setup). */
export async function POST() {
  if (!pushConfigured()) return NextResponse.json({ error: 'push_not_configured' }, { status: 503 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', user.id);
  if (!subs || subs.length === 0) return NextResponse.json({ error: 'no_subscription' }, { status: 404 });

  let sent = 0;
  for (const s of subs) {
    const r = await sendPush(s, { title: 'OptiFi', body: 'As notificações estão a funcionar 🎯', url: '/metas', tag: 'optifi-test' });
    if (r === 'sent') sent++;
    if (r === 'gone') await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
  }
  return NextResponse.json({ ok: true, sent });
}
