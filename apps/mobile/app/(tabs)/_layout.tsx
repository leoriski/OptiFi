import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useI18n } from '../../src/lib/i18n';
import { useTheme } from '../../src/lib/theme-context';
import { AppHeader } from '../../src/AppHeader';
import { BottomNav } from '../../src/BottomNav';
import { ActivityIcon, GoalsIcon, HomeIcon, InsightsIcon, ProfileIcon } from '../../src/icons';

/**
 * A casca da app, igual à da web (`AppShell`): cabeçalho fixo em cima, ecrã no
 * meio, barra de navegação em baixo. As duas pontas são nossas — a barra que
 * vem de origem não faz o chip aceso nem a barrinha do separador ativo.
 *
 * O `FinanceProvider` não vive aqui: está no `_layout` de cima, porque o
 * `/importar` e o `/plano` também precisam dele e ficam fora dos separadores.
 */
export default function TabsLayout() {
  const t0 = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: t0.bg }}>
      <AppHeader />
      <Tabs
        tabBar={(props) => <BottomNav {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t0.bg } }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: t('nav_home'), tabBarIcon: ({ color }) => <HomeIcon color={color} size={20} /> }}
        />
        <Tabs.Screen
          name="analise"
          options={{ title: t('nav_insights'), tabBarIcon: ({ color }) => <InsightsIcon color={color} size={20} /> }}
        />
        <Tabs.Screen
          name="atividade"
          options={{ title: t('nav_activity'), tabBarIcon: ({ color }) => <ActivityIcon color={color} size={20} /> }}
        />
        <Tabs.Screen
          name="metas"
          options={{ title: t('nav_goals'), tabBarIcon: ({ color }) => <GoalsIcon color={color} size={20} /> }}
        />
        <Tabs.Screen
          name="perfil"
          options={{ title: t('nav_profile'), tabBarIcon: ({ color }) => <ProfileIcon color={color} size={20} /> }}
        />
      </Tabs>
    </View>
  );
}
