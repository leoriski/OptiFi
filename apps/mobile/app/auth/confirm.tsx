import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../../src/Text';
import { Screen } from '../../src/ui';
import { useTheme } from '../../src/lib/theme-context';
import { useI18n } from '../../src/lib/i18n';
import { supabase } from '../../src/lib/supabase';

// Destino dos links de email do Supabase (confirmação de conta e recuperação
// de palavra-passe) quando a app já está instalada. Verifica o token e segue
// para o `next`. Quem abrir sem token (ou com token inválido) volta ao login —
// o bloco só faz o replace quando há sessão e por isso não há loop com o Gate.
export default function AuthConfirm() {
  const t0 = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { token_hash, type, next } = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>();

  useEffect(() => {
    if (!token_hash || typeof token_hash !== 'string' || !type || typeof type !== 'string') {
      router.replace('/login');
      return;
    }
    void supabase.auth
      .verifyOtp({ type, token_hash })
      .then(({ error }) => router.replace(error ? '/login' : (next ?? '/')));
  }, [token_hash, type, next, router]);

  return (
    <Screen t={t0}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t0.pr} />
        <Text style={{ marginTop: 14, fontSize: 12.5, color: t0.tx2 }}>{t('auth_confirm_pending')}</Text>
      </View>
    </Screen>
  );
}