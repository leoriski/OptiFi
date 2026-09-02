import { View } from 'react-native';
import { Text } from '../src/Text';
import { useRouter } from 'expo-router';
import { useI18n } from '../src/lib/i18n';
import { AuthShell, LinkText } from '../src/ui';
import { useTheme } from '../src/lib/theme-context';


export default function Verify() {
  const t0 = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  return (
    <AuthShell t={t0} title={t('auth_verify_title')} sub={t('auth_verify_sub')}>
      <Text style={{ fontSize: 12, color: t0.tx3, lineHeight: 18, marginTop: 8 }}>{t('auth_verify_spam')}</Text>
      <View style={{ marginTop: 18 }}>
        <LinkText t={t0} label={t('auth_back_login')} onPress={() => router.replace('/login')} />
      </View>
    </AuthShell>
  );
}
