import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { buildTheme } from '../src/theme';
import { Button, Screen } from '../src/ui';

const t = buildTheme('light', 'emerald');

export default function Login() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    // O redireccionamento é do _layout, que reage à sessão — daqui só se
    // trata do que correu mal.
    if (error) setError(error.message);
    setBusy(false);
  };

  const input = {
    backgroundColor: t.card,
    borderColor: t.b,
    borderWidth: 1,
    borderRadius: t.rs,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: t.tx,
  };

  return (
    <Screen t={t}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22, paddingTop: insets.top + 22 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 28, fontWeight: '900', color: t.tx, letterSpacing: -0.8 }}>OptiFi</Text>
          <Text style={{ fontSize: 13, color: t.tx2, marginTop: 4, marginBottom: 26 }}>
            Entra para veres as tuas contas.
          </Text>

          <View style={{ gap: 10 }}>
            <TextInput
              style={input}
              placeholder="Email"
              placeholderTextColor={t.tx3}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
            />
            <TextInput
              style={input}
              placeholder="Palavra-passe"
              placeholderTextColor={t.tx3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              onSubmitEditing={submit}
            />
            {error ? <Text style={{ color: t.re, fontSize: 12, fontWeight: '700' }}>{error}</Text> : null}
            <Button t={t} label="Entrar" onPress={submit} loading={busy} disabled={!email || !password} />
          </View>

          <Text style={{ fontSize: 11, color: t.tx3, marginTop: 20, lineHeight: 16 }}>
            Ainda não há registo nem login social aqui — cria a conta em optifi.app e entra com ela.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
