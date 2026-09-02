import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from '../src/Text';
import { useRouter } from 'expo-router';
import { supabase, AUTH_REDIRECT, WEB_URL } from '../src/lib/supabase';
import { useI18n } from '../src/lib/i18n';
import { AuthShell, Button, ErrorMsg, Field, LinkText, PasswordField } from '../src/ui';
import { useTheme } from '../src/lib/theme-context';


export default function Signup() {
  const t0 = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (password.length < 8) {
      setError(t('auth_pwd_short'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth_pwd_mismatch'));
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: AUTH_REDIRECT },
    });
    setBusy(false);
    if (err) {
      const code = (err as { code?: string }).code ?? '';
      const msg = err.message.toLowerCase();
      setError(
        code === 'over_email_send_rate_limit' || msg.includes('rate limit')
          ? t('auth_error_rate_limit')
          : code === 'email_address_invalid' || (msg.includes('email address') && msg.includes('invalid'))
            ? t('auth_error_email_invalid')
            : code === 'user_already_exists' || msg.includes('already')
              ? t('auth_error_exists')
              : t('auth_error_generic'),
      );
      return;
    }
    // Com confirmação de email ligada não vem sessão nenhuma; sem ela, o Gate
    // do _layout entra sozinho e este ecrã desaparece.
    if (!data.session) router.replace('/verify');
  }

  return (
    <AuthShell t={t0} title={t('auth_signup_title')} sub={t('auth_signup_sub')}>
      <Field t={t0} label={t('auth_name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
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
        textContentType="newPassword"
        showLabel={t('auth_pwd_show')}
        hideLabel={t('auth_pwd_hide')}
      />
      <PasswordField
        t={t0}
        label={t('auth_password_confirm')}
        value={confirm}
        onChangeText={setConfirm}
        textContentType="newPassword"
        onSubmitEditing={() => void submit()}
        showLabel={t('auth_pwd_show')}
        hideLabel={t('auth_pwd_hide')}
      />

      <Pressable
        onPress={() => setConsent((c) => !c)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 14 }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            marginTop: 1,
            borderRadius: 5,
            borderWidth: 1.5,
            borderColor: consent ? t0.pr : t0.b,
            backgroundColor: consent ? t0.pr : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {consent ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, fontSize: 12, color: t0.tx2, lineHeight: 18 }}>
          {t('consent_accept')}{' '}
<Text style={{ color: t0.pr, fontWeight: '700' }} onPress={() => void Linking.openURL(`${WEB_URL}/termos`)}>
            {t('auth_terms')}
          </Text>{' '}
          <Text style={{ color: t0.tx3 }}>{t('auth_and')}</Text>{' '}
          <Text style={{ color: t0.pr, fontWeight: '700' }} onPress={() => void Linking.openURL(`${WEB_URL}/privacidade`)}>
            {t('auth_privacy')}
          </Text>
          .
        </Text>
      </Pressable>

      <ErrorMsg t={t0}>{error}</ErrorMsg>

      <View style={{ marginTop: 16 }}>
        <Button
          t={t0}
          label={t('auth_signup_btn')}
          onPress={() => void submit()}
          loading={busy}
          disabled={!consent || !email || !password || !confirm}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 16 }}>
        <Text style={{ fontSize: 13, color: t0.tx2 }}>{t('auth_has_account')}</Text>
        <LinkText t={t0} label={t('auth_login_link')} onPress={() => router.replace('/login')} />
      </View>
    </AuthShell>
  );
}
