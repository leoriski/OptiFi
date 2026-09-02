import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Cria o apps/mobile/.env.',
  );
}

/**
 * Onde aterram os links que o Supabase manda por email (confirmar a conta,
 * recuperar a password). Com build de loja o esquema `optifi://` está
 * registado e o link abre a própria app (`app/auth/confirm.tsx`). No Expo Go
 * o esquema não existe — para testar lá, define `EXPO_PUBLIC_AUTH_REDIRECT`
 * para o URL `exp://` do projeto de desenvolvimento.
 */
export const AUTH_REDIRECT = process.env.EXPO_PUBLIC_AUTH_REDIRECT ?? 'optifi://auth/confirm';

/** Site público — só para abrir as páginas legais (termos/privacidade). */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://optifi.pt';

export const supabase = createClient(url, anonKey, {
  auth: {
    // O browser guardava a sessão sozinho; aqui é preciso dizer onde.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Não há URL de retorno para ler: o telemóvel não navega para o callback.
    detectSessionInUrl: false,
  },
});
