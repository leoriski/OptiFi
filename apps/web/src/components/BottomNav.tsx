'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n, type DictKey } from '@/lib/i18n';

// Navegação inferior do protótipo: .nav/.nb com ícone em "chip" que acende
// e etiqueta que só aparece no separador ativo.

const TABS: { href: string; labelKey: DictKey; icon: React.ReactNode }[] = [
  {
    href: '/',
    labelKey: 'nav_home',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
      </svg>
    ),
  },
  {
    href: '/analise',
    labelKey: 'nav_insights',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 3v18h18" />
        <path d="m7 14 4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    href: '/atividade',
    labelKey: 'nav_activity',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M8 6h13M8 12h13M8 18h13" />
        <circle cx="4" cy="6" r="1" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="4" cy="18" r="1" />
      </svg>
    ),
  },
  {
    href: '/metas',
    labelKey: 'nav_goals',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    href: '/perfil',
    labelKey: 'nav_profile',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="nav">
      <div className="nav-inner">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href} className={`nb${active ? ' on' : ''}`} style={{ textDecoration: 'none' }}>
              <div className="nb-icon">{tab.icon}</div>
              <span className="nb-label">{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
