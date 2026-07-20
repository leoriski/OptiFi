'use client';

// Conteúdo do drawer "Segurança": alterar palavra-passe, 2FA (TOTP) e
// exportação de dados. O apagar conta vive no fundo do Perfil (como no
// protótipo) e os links legais no drawer "Sobre".

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';

interface Enrolling {
  factorId: string;
  qr: string;
  secret: string;
}

export function SecuritySection() {
  const { t } = useI18n();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Alterar palavra-passe
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === 'verified');
    setFactorId(verified?.id ?? null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function changePassword() {
    setPwdMsg(null);
    if (pwd.length < 8) {
      setPwdMsg({ ok: false, text: t('auth_pwd_short') });
      return;
    }
    if (pwd !== pwd2) {
      setPwdMsg({ ok: false, text: t('auth_pwd_mismatch') });
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) {
      setPwdMsg({ ok: false, text: t('auth_error_generic') });
      return;
    }
    setPwd('');
    setPwd2('');
    setPwdMsg({ ok: true, text: t('pwd_ok') });
  }

  async function startEnroll() {
    setError('');
    setBusy(true);
    const supabase = createClient();
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'OptiFi' });
    setBusy(false);
    if (error || !data) {
      setError(t('auth_error_generic'));
      return;
    }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode('');
  }

  async function confirmEnroll() {
    if (!enrolling || code.length !== 6) return;
    setError('');
    setBusy(true);
    const supabase = createClient();
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (chErr || !ch) {
      setBusy(false);
      setError(t('auth_error_generic'));
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrolling.factorId, challengeId: ch.id, code });
    setBusy(false);
    if (error) {
      setError(t('sec_2fa_bad_code'));
      return;
    }
    setEnrolling(null);
    setCode('');
    await refresh();
  }

  async function disable() {
    if (!factorId) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      setError(t('auth_error_generic'));
      return;
    }
    await refresh();
  }

  const secHdr: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: 'var(--tx2)', margin: '0 0 9px' };

  return (
    <>
      {/* Alterar palavra-passe */}
      <div className="card">
        <div style={secHdr}>{t('pwd_change')}</div>
        <input className="auth-input" type="password" autoComplete="new-password" placeholder={t('auth_password')} value={pwd} onChange={(e) => setPwd(e.target.value)} style={{ marginBottom: 8 }} />
        <input className="auth-input" type="password" autoComplete="new-password" placeholder={t('auth_password_confirm')} value={pwd2} onChange={(e) => setPwd2(e.target.value)} style={{ marginBottom: 10 }} />
        {pwdMsg && (
          <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: pwdMsg.ok ? 'var(--gr)' : 'var(--re)' }}>{pwdMsg.text}</div>
        )}
        <button className="btn-secondary" style={{ padding: 11, fontSize: 12 }} disabled={busy} onClick={() => void changePassword()}>
          {t('auth_update_pwd_btn')}
        </button>
      </div>

      {/* 2FA */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={secHdr}>{t('sec_2fa')}</div>
          <span style={{ fontSize: 11, fontWeight: 800, color: factorId ? 'var(--tx)' : 'var(--tx3)' }}>
            {factorId ? t('sec_2fa_on') : t('sec_2fa_off')}
          </span>
        </div>
        {!enrolling && !factorId && (
          <button className="btn-secondary" style={{ padding: 10, fontSize: 12 }} disabled={busy} onClick={() => void startEnroll()}>
            {t('sec_2fa_enable')}
          </button>
        )}
        {!enrolling && factorId && (
          <button className="btn-secondary" style={{ padding: 10, fontSize: 12, color: 'var(--tx2)' }} disabled={busy} onClick={() => void disable()}>
            {t('sec_2fa_disable')}
          </button>
        )}
        {enrolling && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 10 }}>{t('sec_2fa_scan')}</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrolling.qr} alt="QR 2FA" width={168} height={168} style={{ background: '#fff', borderRadius: 8, padding: 6 }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 2 }}>{t('sec_2fa_secret')}</div>
            <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', color: 'var(--tx2)', marginBottom: 10 }}>{enrolling.secret}</code>
            <input
              className="auth-input"
              inputMode="numeric"
              maxLength={6}
              placeholder={t('sec_2fa_code')}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              style={{ marginBottom: 8 }}
            />
            <button className="btn-primary" style={{ padding: 11, fontSize: 12 }} disabled={busy || code.length !== 6} onClick={() => void confirmEnroll()}>
              {t('sec_2fa_confirm')}
            </button>
          </div>
        )}
        {error && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--re)' }}>{error}</div>}
      </div>

      {/* Dados (RGPD) */}
      <div className="card">
        <a href="/api/export" className="btn-secondary" style={{ padding: 10, fontSize: 12, textDecoration: 'none', display: 'block' }}>
          {t('sec_export')}
        </a>
      </div>
    </>
  );
}
