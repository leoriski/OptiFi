'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { AuthCard, ErrorMsg, FieldLabel } from '@/components/AuthCard';
import { SocialAuth } from '@/components/SocialAuth';

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('auth_pwd_short'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth_pwd_mismatch'));
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setBusy(false);
    if (error) {
      const code = (error as { code?: string }).code ?? '';
      const msg = error.message.toLowerCase();
      setError(
        code === 'over_email_send_rate_limit' || msg.includes('rate limit')
          ? t('auth_error_rate_limit')
          : code === 'email_address_invalid' || (msg.includes('email address') && msg.includes('invalid'))
            ? t('auth_error_email_invalid')
            : code === 'user_already_exists' || msg.includes('already')
              ? t('auth_error_exists')
              : t('auth_error_generic'),
      );
      return;
    }
    router.push('/verify');
  }

  return (
    <AuthCard title={t('auth_signup_title')} sub={t('auth_signup_sub')}>
      <form onSubmit={onSubmit}>
        <FieldLabel>{t('auth_name')}</FieldLabel>
        <input className="auth-input" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <FieldLabel>{t('auth_email')}</FieldLabel>
        <input className="auth-input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FieldLabel>{t('auth_password')}</FieldLabel>
        <input className="auth-input" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FieldLabel>{t('auth_password_confirm')}</FieldLabel>
        <input className="auth-input" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 14, fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, cursor: 'pointer' }}>
          <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            {t('consent_accept')}{' '}
            <a href="/termos" target="_blank" style={{ color: 'var(--pr)', fontWeight: 700 }}>{t('consent_terms')}</a>{' '}
            {t('consent_and')}{' '}
            <a href="/privacidade" target="_blank" style={{ color: 'var(--pr)', fontWeight: 700 }}>{t('consent_privacy')}</a>.
          </span>
        </label>
        <ErrorMsg>{error}</ErrorMsg>
        <button className="btn-primary" style={{ marginTop: 16 }} disabled={busy || !consent} type="submit">
          {t('auth_signup_btn')}
        </button>
      </form>
      <SocialAuth />
      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--tx2)' }}>
        {t('auth_has_account')}{' '}
        <Link href="/login" style={{ color: 'var(--pr)', fontWeight: 800, textDecoration: 'none' }}>
          {t('auth_login_link')}
        </Link>
      </div>
    </AuthCard>
  );
}
