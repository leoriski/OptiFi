import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente com SERVICE ROLE — SÓ para rotas de servidor de confiança (o job de
// lembretes precisa de ler as metas de todos os utilizadores). A chave nunca
// sai do servidor. Devolve null se não estiver configurada (dev sem secret).
export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
