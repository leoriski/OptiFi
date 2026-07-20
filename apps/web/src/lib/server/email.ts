// Envio de email via Resend. No-op se RESEND_API_KEY não estiver definida
// (dev/beta antes do domínio verificado) — devolve 'skipped' sem rebentar.
const KEY = process.env.RESEND_API_KEY ?? '';
const FROM = process.env.RESEND_FROM ?? 'OptiFi <lembretes@optifi.pt>';

export async function sendEmail(to: string, subject: string, html: string): Promise<'sent' | 'skipped' | 'error'> {
  if (!KEY) return 'skipped';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    return res.ok ? 'sent' : 'error';
  } catch {
    return 'error';
  }
}
