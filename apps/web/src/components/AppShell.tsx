'use client';

import { useI18n } from '@/lib/i18n';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { InstallBanner } from '@/components/PwaSetup';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  return (
    <>
      <AppHeader secureLabel={lang === 'pt' ? 'Seguro' : 'Secure'} />
      <InstallBanner />
      <main className="main">{children}</main>
      <BottomNav />
    </>
  );
}
