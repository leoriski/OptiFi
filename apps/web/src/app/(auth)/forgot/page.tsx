'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { AuthCard, FieldLabel, OkMsg } from '@/components/AuthCard';

export default function ForgotPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
    });
    setBusy(false);
    // Resposta idêntica exista o email ou não — não revelamos contas.
    setSent(true);
  }

  return (
    <AuthCard title={t('auth_forgot_title')} sub={t('auth_forgot_sub')}>
      <form onSubmit={onSubmit}>
        <FieldLabel>{t('auth_email')}</FieldLabel>
        <input className="auth-input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <OkMsg>{sent ? t('auth_forgot_sent') : ''}</OkMsg>
        <button className="btn-primary" style={{ marginTop: 18 }} disabled={busy || sent} type="submit">
          {t('auth_forgot_btn')}
        </button>
      </form>
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link href="/login" style={{ fontSize: 13, color: 'var(--pr)', fontWeight: 700, textDecoration: 'none' }}>
          {t('auth_back_login')}
        </Link>
      </div>
    </AuthCard>
  );
}
