import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../src/Text';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useI18n } from '../src/lib/i18n';
import { AuthShell, Button, ErrorMsg, Field, LinkText, PasswordField } from '../src/ui';
import { useTheme } from '../src/lib/theme-context';


export default function Login() {
  const t0 = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(
        code === 'email_not_confirmed'
          ? t('auth_error_unconfirmed')
          : err.message.includes('Invalid')
            ? t('auth_error_invalid')
            : t('auth_error_generic'),
      );
      return;
    }
    // Contas com 2FA ficam em aal1 depois da password — completa-se em /mfa.
    // Sem 2FA não há nada a fazer aqui: o Gate do _layout vê a sessão e entra.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') router.replace('/mfa');
  }

  return (
    <AuthShell t={t0} title={t('auth_login_title')} sub={t('auth_login_sub')}>
      <Field
        t={t0}
        label={t('auth_email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <PasswordField
        t={t0}
        label={t('auth_password')}
        value={password}
        onChangeText={setPassword}
        textContentType="password"
        onSubmitEditing={() => void submit()}
        showLabel={t('auth_pwd_show')}
        hideLabel={t('auth_pwd_hide')}
      />
      <ErrorMsg t={t0}>{error}</ErrorMsg>

      <View style={{ marginTop: 18 }}>
        <Button
          t={t0}
          label={t('auth_login_btn')}
          onPress={() => void submit()}
          loading={busy}
          disabled={!email || !password}
        />
      </View>

      <View style={{ marginTop: 14 }}>
        <LinkText t={t0} label={t('auth_forgot')} onPress={() => router.push('/forgot')} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 16 }}>
        <Text style={{ fontSize: 13, color: t0.tx2 }}>{t('auth_no_account')}</Text>
        <LinkText t={t0} label={t('auth_signup_link')} onPress={() => router.push('/signup')} />
      </View>
    </AuthShell>
  );
}
