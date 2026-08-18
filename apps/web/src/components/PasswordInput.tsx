'use client';

import { useState, type CSSProperties } from 'react';
import { useI18n } from '@/lib/i18n';

/**
 * Campo de password com botão para mostrar o que se escreveu.
 *
 * Escrever às cegas num telemóvel é a principal razão para falhar a criação de
 * conta: erra-se uma tecla, o "confirmar" não bate certo e ninguém percebe
 * porquê. Ver o que se escreveu resolve isso melhor do que qualquer mensagem
 * de erro.
 */
export function PasswordInput({
  value,
  onChange,
  autoComplete,
  required = false,
  placeholder,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  required?: boolean;
  placeholder?: string;
  style?: CSSProperties;
}) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  return (
    <div className="auth-input-wrap" style={style}>
      <input
        className="auth-input"
        type={show ? 'text' : 'password'}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Espaço à direita para o texto não passar por baixo do botão.
        style={{ paddingRight: 48 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t('auth_pwd_hide') : t('auth_pwd_show')}
        aria-pressed={show}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: show ? 'var(--pr)' : 'var(--tx3)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {show ? (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </>
          ) : (
            <>
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
