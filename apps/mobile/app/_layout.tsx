import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/lib/session';
import { useAppLock } from '../src/lib/lock';
import { buildTheme } from '../src/theme';
import { Button, Screen } from '../src/ui';

const t = buildTheme('light', 'emerald');

function Gate() {
  const { session, loading } = useSession();
  const lock = useAppLock(!!session);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'login';
    if (!session && !inAuth) router.replace('/login');
    else if (session && inAuth) router.replace('/');
  }, [session, loading, segments, router]);

  if (loading) {
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
          <Text style={{ fontSize: 20, fontWeight: '900', color: t.tx }}>OptiFi trancada</Text>
          <Text style={{ fontSize: 13, color: t.tx2, textAlign: 'center', marginBottom: 18 }}>
            Usa o Face ID para voltares às tuas contas.
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <Button t={t} label="Desbloquear" onPress={() => void lock.unlock()} />
          </View>
        </View>
      </Screen>
    );
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style={t.mode === 'light' ? 'dark' : 'light'} />
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
