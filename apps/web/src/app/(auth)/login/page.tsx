'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { AuthCard, ErrorMsg, FieldLabel } from '@/components/AuthCard';
import { SocialAuth } from '@/components/SocialAuth';
import { PasswordInput } from '@/components/PasswordInput';

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const code = (error as { code?: string }).code ?? '';
      setError(
        code === 'email_not_confirmed'
          ? t('auth_error_unconfirmed')
          : error.message.includes('Invalid')
            ? t('auth_error_invalid')
            : t('auth_error_generic'),
      );
      return;
    }
    // Contas com 2FA ficam em aal1 após a password — completa-se em /mfa.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    router.push(aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2' ? '/mfa' : '/');
    router.refresh();
  }

  return (
    <AuthCard title={t('auth_login_title')} sub={t('auth_login_sub')}>
      <form onSubmit={onSubmit}>
        <FieldLabel>{t('auth_email')}</FieldLabel>
        <input className="auth-input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FieldLabel>{t('auth_password')}</FieldLabel>
        <PasswordInput required autoComplete="current-password" value={password} onChange={setPassword} />
        <ErrorMsg>{error}</ErrorMsg>
        <button className="btn-primary" style={{ marginTop: 18 }} disabled={busy} type="submit">
          {t('auth_login_btn')}
        </button>
      </form>
      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <Link href="/forgot" style={{ fontSize: 12, color: 'var(--pr)', fontWeight: 700, textDecoration: 'none' }}>
          {t('auth_forgot')}
        </Link>
      </div>
      <SocialAuth />
      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--tx2)' }}>
        {t('auth_no_account')}{' '}
        <Link href="/signup" style={{ color: 'var(--pr)', fontWeight: 800, textDecoration: 'none' }}>
          {t('auth_signup_link')}
        </Link>
      </div>
    </AuthCard>
  );
}
