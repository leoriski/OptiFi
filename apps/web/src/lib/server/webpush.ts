import webpush from 'web-push';

// Configuração central do Web Push (VAPID). Só configura se as chaves
// existirem — sem elas, sendPush é um no-op silencioso (dev sem secrets).
const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:optifi@example.com';

let configured = false;
export function pushConfigured(): boolean {
  if (!PUBLIC || !PRIVATE) return false;
  if (!configured) {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  }
  return true;
}

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Envia uma notificação a uma subscrição. Devolve 'gone' se o endpoint expirou (404/410). */
export async function sendPush(sub: PushSub, payload: { title: string; body: string; url?: string; tag?: string }): Promise<'sent' | 'gone' | 'error'> {
  if (!pushConfigured()) return 'error';
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return 'sent';
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? 'gone' : 'error';
  }
}
