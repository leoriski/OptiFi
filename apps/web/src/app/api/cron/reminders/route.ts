import { NextResponse, type NextRequest } from 'next/server';
import { serviceClient } from '@/lib/server/serviceClient';
import { sendPush, pushConfigured } from '@/lib/server/webpush';
import { sendEmail } from '@/lib/server/email';

export const runtime = 'nodejs';

// Job DIÁRIO (chamado por um cron): lembra cada utilizador das metas cuja
// alocação mensal é HOJE e ainda não foi feita.
// Idempotente por dia — reenviar não duplica registos (só reenvia o aviso).
// O header pode ser `x-cron-secret` (crons externos) ou `Authorization: Bearer`
// (Vercel Cron).

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const viaHeader = request.headers.get('x-cron-secret');
  if (!secret || (bearer !== secret && viaHeader !== secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = serviceClient();
  if (!db) return NextResponse.json({ error: 'service_not_configured' }, { status: 503 });

  const now = new Date();
  const today = now.getUTCDate();
  const month = monthKey(now);

  // Metas cuja alocação é hoje (com valor mensal).
  const { data: goals } = await db
    .from('goals')
    .select('id,user_id,name,monthly_allocation,allocation_day')
    .eq('allocation_day', today)
    .gt('monthly_allocation', 0);
  if (!goals || goals.length === 0) return NextResponse.json({ ok: true, reminded: 0 });

  // Quais já foram alocadas este mês → não lembrar.
  const goalIds = goals.map((g) => g.id as string);
  const { data: done } = await db.from('goal_monthly_allocations').select('goal_id').eq('month', month).in('goal_id', goalIds);
  const doneSet = new Set((done ?? []).map((d) => d.goal_id as string));
  const pending = goals.filter((g) => !doneSet.has(g.id as string));
  if (pending.length === 0) return NextResponse.json({ ok: true, reminded: 0 });

  // Agrupa por utilizador.
  const byUser = new Map<string, { name: string; amount: number }[]>();
  for (const g of pending) {
    const list = byUser.get(g.user_id as string) ?? [];
    list.push({ name: (g.name as string) || 'Meta', amount: Number(g.monthly_allocation) });
    byUser.set(g.user_id as string, list);
  }

  let reminded = 0;
  for (const [userId, items] of byUser) {
    // Respeita a preferência de lembretes.
    const { data: prof } = await db.from('profiles').select('goal_reminders').eq('id', userId).maybeSingle();
    if (prof && prof.goal_reminders === false) continue;

    const total = items.reduce((a, b) => a + b.amount, 0);
    const names = items.map((i) => i.name).join(', ');
    const title = 'Lembrete de metas · OptiFi';
    const body =
      items.length === 1
        ? `Hoje é dia de reservar ${total.toFixed(2)}€ para "${names}". Já transferiste?`
        : `Hoje é dia de reservar ${total.toFixed(2)}€ para ${items.length} metas (${names}).`;

    // Push a todos os dispositivos do utilizador.
    if (pushConfigured()) {
      const { data: subs } = await db.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', userId);
      for (const s of subs ?? []) {
        const r = await sendPush(s, { title, body, url: '/metas', tag: 'optifi-goal-reminder' });
        if (r === 'gone') await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }

    // Email (via admin API para obter o endereço).
    const { data: userRes } = await db.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (email) {
      const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#0f1623">
        <h2 style="margin:0 0 8px">Lembrete de metas</h2>
        <p style="margin:0 0 12px;color:#566175">${body}</p>
        <p style="margin:0"><a href="https://optifi.pt/metas" style="color:#1557d6;font-weight:700;text-decoration:none">Abrir as minhas metas →</a></p>
      </div>`;
      await sendEmail(email, title, html);
    }
    reminded++;
  }

  return NextResponse.json({ ok: true, reminded });
}
