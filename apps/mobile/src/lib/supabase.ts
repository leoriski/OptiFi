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
