'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { AuthCard, ErrorMsg, FieldLabel, OkMsg } from '@/components/AuthCard';

export default function UpdatePasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
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
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(t('auth_error_generic'));
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 1200);
  }

  return (
    <AuthCard title={t('auth_update_pwd_title')}>
      <form onSubmit={onSubmit}>
        <FieldLabel>{t('auth_password')}</FieldLabel>
        <input className="auth-input" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FieldLabel>{t('auth_password_confirm')}</FieldLabel>
        <input className="auth-input" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <ErrorMsg>{error}</ErrorMsg>
        <OkMsg>{done ? t('auth_updated_pwd') : ''}</OkMsg>
        <button className="btn-primary" style={{ marginTop: 18 }} disabled={busy || done} type="submit">
          {t('auth_update_pwd_btn')}
        </button>
      </form>
    </AuthCard>
  );
}
