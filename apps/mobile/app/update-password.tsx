import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useI18n } from '../src/lib/i18n';
import { AuthShell, Button, ErrorMsg, OkMsg, PasswordField } from '../src/ui';
import { useTheme } from '../src/lib/theme-context';


export default function UpdatePassword() {
  const t0 = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
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
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(t('auth_error_generic'));
      return;
    }
    setDone(true);
    setTimeout(() => router.replace('/'), 1200);
  }

  return (
    <AuthShell t={t0} title={t('auth_update_pwd_title')}>
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
      <ErrorMsg t={t0}>{error}</ErrorMsg>
      <OkMsg t={t0}>{done ? t('auth_updated_pwd') : ''}</OkMsg>
      <View style={{ marginTop: 18 }}>
        <Button
          t={t0}
          label={t('auth_update_pwd_btn')}
          onPress={() => void submit()}
          loading={busy}
          disabled={done || !password || !confirm}
        />
      </View>
    </AuthShell>
  );
}
