'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { AuthCard, ErrorMsg } from '@/components/AuthCard';

export default function MfaPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal || aal.currentLevel === 'aal2' || aal.nextLevel !== 'aal2') {
        router.replace('/');
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      setFactorId(data?.totp?.find((f) => f.status === 'verified')?.id ?? null);
    })();
  }, [router]);

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setError('');
    setBusy(true);
    const supabase = createClient();
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setBusy(false);
      setError(t('auth_error_generic'));
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    setBusy(false);
    if (vErr) {
      setError(t('sec_2fa_bad_code'));
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <AuthCard title={t('mfa_title')} sub={t('mfa_sub')}>
      <input
        className="auth-input"
        inputMode="numeric"
        maxLength={6}
        autoFocus
        placeholder={t('sec_2fa_code')}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void verify();
        }}
      />
      <ErrorMsg>{error}</ErrorMsg>
      <button className="btn-primary" style={{ marginTop: 14 }} disabled={busy || code.length !== 6} onClick={() => void verify()}>
        {t('mfa_verify')}
      </button>
    </AuthCard>
  );
}
