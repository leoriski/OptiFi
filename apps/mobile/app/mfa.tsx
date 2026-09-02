import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useI18n } from '../src/lib/i18n';
import { AuthShell, Button, ErrorMsg, Field } from '../src/ui';
import { useTheme } from '../src/lib/theme-context';


export default function Mfa() {
  const t0 = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal || aal.currentLevel === 'aal2' || aal.nextLevel !== 'aal2') {
        router.replace('/');
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      setFactorId(data?.totp?.find((f) => f.status === 'verified')?.id ?? null);
    })();
  }, [router]);

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setError('');
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setBusy(false);
      setError(t('auth_error_generic'));
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    setBusy(false);
    if (vErr) {
      setError(t('sec_2fa_bad_code'));
      return;
    }
    router.replace('/');
  }

  return (
    <AuthShell t={t0} title={t('mfa_title')} sub={t('mfa_sub')}>
      <Field
        t={t0}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        placeholder={t('sec_2fa_code')}
        onSubmitEditing={() => void verify()}
        style={{ marginTop: 12, fontSize: 22, fontWeight: '800', letterSpacing: 6, textAlign: 'center' }}
      />
      <ErrorMsg t={t0}>{error}</ErrorMsg>
      <View style={{ marginTop: 14 }}>
        <Button t={t0} label={t('mfa_verify')} onPress={() => void verify()} loading={busy} disabled={code.length !== 6} />
      </View>
    </AuthShell>
  );
}
