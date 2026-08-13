'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

// Evento do Chrome/Android que permite abrir o instalador a partir da app.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED = 'optifi_install_dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Safari em iPhone/iPad: não há API de instalação, só o menu Partilhar. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Regista o service worker. Fica na raiz e não só na área com login: quem
 * abre a app sem rede tem de ver a página de offline mesmo antes de entrar,
 * e o worker do push tem de existir antes de alguém ativar notificações.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}

/**
 * Convida a instalar a app no ecrã inicial, uma só vez. Não insiste — quem
 * dispensa não volta a ver o convite.
 */
export function InstallBanner() {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED) === '1') return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // sem isto o Chrome mostra o seu próprio banner
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (isIosSafari()) setShowIos(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!prompt && !showIos) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED, '1');
    setPrompt(null);
    setShowIos(false);
  };

  return (
    <div className="card" style={{ margin: '13px 12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx)' }}>{t('pwa_install_title')}</div>
        <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginTop: 2 }}>
          {prompt ? t('pwa_install_sub') : t('pwa_install_ios')}
        </div>
      </div>
      {prompt && (
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '0 16px', height: 38, fontSize: 13, flexShrink: 0 }}
          onClick={() => {
            void prompt.prompt();
            dismiss();
          }}
        >
          {t('pwa_install_cta')}
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label={t('pwa_install_dismiss')}
        style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 1 }}
      >
        ✕
      </button>
    </div>
  );
}
