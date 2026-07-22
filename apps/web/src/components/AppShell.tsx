'use client';

import { useI18n } from '@/lib/i18n';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { DemoBanner } from '@/components/DemoBanner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  return (
    <>
      <AppHeader secureLabel={lang === 'pt' ? 'Seguro' : 'Secure'} />
      <DemoBanner />
      <main className="main">{children}</main>
      <BottomNav />
    </>
  );
}
