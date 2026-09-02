import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../src/Text';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/lib/session';
import { FinanceProvider } from '../src/lib/finance';
import { LockProvider, useLock } from '../src/lib/lock';
import { I18nProvider, useI18n } from '../src/lib/i18n';
import { ThemeProvider, useTheme } from '../src/lib/theme-context';
import { Button, Screen } from '../src/ui';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '../src/Text';

/**
 * Ecrãs que se abrem sem sessão. `mfa` e `update-password` ficam de fora de
 * propósito: nos dois já há sessão (a `mfa` fica em aal1 depois da password), e
 * listá-los aqui atirava o utilizador para o Início a meio do 2FA.
 */
const PUBLIC = new Set(['login', 'signup', 'forgot', 'verify', 'auth']);

function Gate() {
  const t = useTheme();
  const { t: tr } = useI18n();
  const { session, loading } = useSession();
  // A Manrope é a identidade da marca. Desenhar primeiro com a fonte do
  // sistema e trocar a meio dava um salto visível em todos os números — mais
  // vale esperar os poucos milissegundos que ela demora a carregar.
  const [fontsReady] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const lock = useLock();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inPublic = PUBLIC.has(segments[0] ?? '');
    if (!session && !inPublic) router.replace('/login');
    else if (session && inPublic) router.replace('/');
  }, [session, loading, segments, router]);

  if (loading || !fontsReady) {
    return (
      <Screen t={t}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.pr} />
        </View>
      </Screen>
    );
  }

  // O bloqueio tapa a app inteira: se aparecesse por cima de um ecrã já
  // desenhado, os números ficavam visíveis por trás — que é o que ele existe
  // para evitar.
  if (lock.locked) {
    return (
      <Screen t={t}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: t.tx }}>{tr('lock_title')}</Text>
          <Text style={{ fontSize: 13, color: t.tx2, textAlign: 'center', marginBottom: 18 }}>
            {tr('lock_sub')}
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <Button t={t} label={tr('lock_unlock')} onPress={() => void lock.unlock()} />
          </View>
        </View>
      </Screen>
    );
  }

  const stack = <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />;
  // O `FinanceProvider` envolve a pilha inteira, e não só os separadores: o
  // `/importar` e o `/plano` também leem daqui. Só entra com sessão — sem ela
  // não há nada para ir buscar, e os ecrãs de login não o usam.
  return session ? <FinanceProvider>{stack}</FinanceProvider> : stack;
}

/** O bloqueio precisa de saber se há sessão, por isso fica por dentro dela. */
function WithSession() {
  const { session } = useSession();
  return (
    <LockProvider hasSession={!!session}>
      <Gate />
    </LockProvider>
  );
}

/** A barra de estado segue o modo — texto escuro no claro, claro no escuro. */
function Bar() {
  const t = useTheme();
  return <StatusBar style={t.mode === 'light' ? 'dark' : 'light'} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Bar />
        <I18nProvider>
          <SessionProvider>
            <WithSession />
          </SessionProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
