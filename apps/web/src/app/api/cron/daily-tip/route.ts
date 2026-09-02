import { NextResponse, type NextRequest } from 'next/server';
import { serviceClient } from '@/lib/server/serviceClient';
import { sendPush, pushConfigured } from '@/lib/server/webpush';
import { tipOfTheDay } from '@/lib/server/tips';

export const runtime = 'nodejs';

// Job DIÁRIO: envia a dica do dia por notificação a quem tem push ativo e não a
// desligou. Separado do cron de metas porque o público é outro — as metas só
// tocam a quem tem alocação hoje, a dica vai a toda a gente.
// Só push: uma dica não justifica um email.
// O header pode ser `x-cron-secret` (crons externos) ou `Authorization: Bearer`
// (Vercel Cron).

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const viaHeader = request.headers.get('x-cron-secret');
  if (!secret || (bearer !== secret && viaHeader !== secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = serviceClient();
  if (!db) return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });
  if (!pushConfigured()) return NextResponse.json({ error: 'push_not_configured' }, { status: 503 });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const body = tipOfTheDay(now);

  const { data: subs } = await db.from('push_subscriptions').select('user_id,endpoint,p256dh,auth');
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Quem já recebeu hoje (o cron pode ser repetido) e quem desligou a dica.
  const userIds = [...new Set(subs.map((s) => s.user_id as string))];
  const [{ data: already }, { data: profs }] = await Promise.all([
    db.from('daily_tip_sends').select('user_id').eq('sent_on', today).in('user_id', userIds),
    db.from('profiles').select('id,daily_tips').in('id', userIds),
  ]);
  const skip = new Set((already ?? []).map((r) => r.user_id as string));
  for (const p of profs ?? []) {
    if (p.daily_tips === false) skip.add(p.id as string);
  }

  let sent = 0;
  for (const userId of userIds) {
    if (skip.has(userId)) continue;
    // Marcar ANTES de enviar: se o envio falhar a meio dos dispositivos, é
    // preferível o utilizador não receber a dica a recebê-la duas vezes.
    const { error } = await db.from('daily_tip_sends').insert({ user_id: userId, sent_on: today });
    if (error) continue;

    for (const s of subs.filter((x) => x.user_id === userId)) {
      const r = await sendPush(s, { title: 'Dica do dia · OptiFi', body, url: '/', tag: 'optifi-daily-tip' });
      if (r === 'gone') await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
