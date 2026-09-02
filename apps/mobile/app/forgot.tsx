import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, AUTH_REDIRECT } from '../src/lib/supabase';
import { useI18n } from '../src/lib/i18n';
import { AuthShell, Button, Field, LinkText, OkMsg } from '../src/ui';
import { useTheme } from '../src/lib/theme-context';


export default function Forgot() {
  const t0 = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${AUTH_REDIRECT}?next=/update-password`,
    });
    setBusy(false);
    // Resposta idêntica exista o email ou não — não revelamos contas.
    setSent(true);
  }

  return (
    <AuthShell t={t0} title={t('auth_forgot_title')} sub={t('auth_forgot_sub')}>
      <Field
        t={t0}
        label={t('auth_email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={() => void submit()}
      />
      <OkMsg t={t0}>{sent ? t('auth_forgot_sent') : ''}</OkMsg>
      <View style={{ marginTop: 18 }}>
        <Button t={t0} label={t('auth_forgot_btn')} onPress={() => void submit()} loading={busy} disabled={sent || !email} />
      </View>
      <View style={{ marginTop: 16 }}>
        <LinkText t={t0} label={t('auth_back_login')} onPress={() => router.replace('/login')} />
      </View>
    </AuthShell>
  );
}
