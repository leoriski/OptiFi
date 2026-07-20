import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

// Toda a área com login é dinâmica: depende da sessão (cookies) e faz fetch no
// cliente. Não há HTML estático útil para gerar — evitamos a pré-renderização
// estática (que falhava no build) e servimos on-demand.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defesa em profundidade: o middleware já protege, mas o layout revalida.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <AppShell>{children}</AppShell>;
}
