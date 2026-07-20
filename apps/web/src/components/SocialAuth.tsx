'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { ErrorMsg } from '@/components/AuthCard';

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  padding: 12,
  background: 'var(--card2)',
  border: '1px solid var(--b)',
  borderRadius: 'var(--rs)',
  color: 'var(--tx)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12.01 12.01 0 0 0 0 10.76l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.23 0 12 0A11.99 11.99 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.72 12.53c.03 3.13 2.75 4.17 2.78 4.18-.02.07-.43 1.48-1.43 2.94-.86 1.26-1.76 2.51-3.17 2.54-1.39.03-1.84-.82-3.42-.82-1.59 0-2.08.79-3.4.85-1.36.05-2.4-1.36-3.27-2.61-1.78-2.57-3.14-7.25-1.31-10.42A5.08 5.08 0 0 1 7.78 6.6c1.34-.03 2.6.9 3.42.9.82 0 2.36-1.11 3.98-.95.68.03 2.58.27 3.8 2.06-.1.06-2.27 1.33-2.26 3.92ZM14.1 4.85c.72-.87 1.2-2.08 1.07-3.29-1.04.04-2.29.69-3.03 1.56-.67.77-1.25 2-1.09 3.19 1.15.09 2.33-.59 3.05-1.46Z" />
    </svg>
  );
}

/**
 * Botões de OAuth (Google/Apple). Só funcionam depois de o provider estar
 * ativado no dashboard do Supabase; até lá mostram uma mensagem honesta em
 * vez de um erro genérico.
 */
export function SocialAuth() {
  const { t } = useI18n();
  const [err, setErr] = useState('');

  async function social(provider: 'google' | 'apple') {
    setErr('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // Sem erro, o browser navega para o provider — nada mais a fazer aqui.
    if (error) setErr(t('auth_social_unavailable'));
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 14px' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--b)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)' }}>{t('auth_or')}</span>
        <span style={{ flex: 1, height: 1, background: 'var(--b)' }} />
      </div>
      <button type="button" style={btnStyle} onClick={() => void social('google')}>
        <GoogleIcon />
        {t('auth_google')}
      </button>
      <button type="button" style={{ ...btnStyle, marginTop: 8 }} onClick={() => void social('apple')}>
        <AppleIcon />
        {t('auth_apple')}
      </button>
      <ErrorMsg>{err}</ErrorMsg>
    </div>
  );
}
