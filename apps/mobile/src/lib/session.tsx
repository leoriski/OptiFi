import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface SessionState {
  session: Session | null;
  /** Enquanto for true ainda não sabemos se há sessão — não decidir nada. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState>({ session: null, loading: true, signOut: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ session, loading, signOut: async () => void supabase.auth.signOut() }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
