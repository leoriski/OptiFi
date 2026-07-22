'use client';

// Barra persistente que assinala o modo demonstração e oferece o salto para a
// importação real. Lê o cookie a cada navegação (o modo é ligado/desligado
// noutras vistas).

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isDemoActive, exitDemo } from '@/lib/demo';
import { useI18n } from '@/lib/i18n';

export function DemoBanner() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isDemoActive());
  }, [pathname]);

  if (!active) return null;
  return (
    <div className="demo-banner">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span className="demo-banner-txt">{t('demo_banner')}</span>
      <button
        className="demo-banner-cta"
        onClick={() => {
          exitDemo();
          setActive(false);
          router.push('/atividade');
        }}
      >
        {t('demo_banner_cta')}
      </button>
    </div>
  );
}
