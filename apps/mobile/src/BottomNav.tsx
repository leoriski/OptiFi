import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text } from './Text';
import { useTheme } from './lib/theme-context';
import { alpha } from './ui';

/**
 * A barra `.nav`/`.nb` da web, desenhada à mão.
 *
 * A barra que o expo-router traz por omissão não consegue ser isto: o ícone
 * vive num chip de 36×36 que acende quando o separador está ativo, a etiqueta
 * está sempre visível (decisão do `globals.css` — quem abre a app pela
 * primeira vez tem de perceber o que cada ícone é), e o ativo leva uma barra
 * de 3px encostada ao topo.
 *
 * O chip aceso leva o accent a 12% — o mesmo valor que o `prototype.css` já
 * usava em modo claro (o protótipo tinha lá um azul fixo, corrigido agora
 * também no escuro).
 *
 * A web põe `backdrop-filter: blur(28px)` por baixo de um branco a 85%. Sem o
 * `expo-blur` instalado, aqui a barra é opaca — é a única diferença, e é
 * invisível a não ser que haja conteúdo a passar por baixo.
 */

/** Cinzento fixo do protótipo para o separador inativo (não vem do tema). */
const INACTIVE = '#4A5568';

export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: t.bg2, borderTopWidth: 1, borderTopColor: t.b }}>
      <View
        style={{
          flexDirection: 'row',
          width: '100%',
          maxWidth: 580,
          alignSelf: 'center',
          paddingTop: 10,
          paddingHorizontal: 8,
          // A web soma `env(safe-area-inset-bottom)` aos 22px por causa do
          // indicador de home do iPhone, que tapava os ícones.
          paddingBottom: 22 + insets.bottom,
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const on = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = on ? t.pr : INACTIVE;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!on && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={on ? { selected: true } : {}}
              accessibilityLabel={label}
              style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 4 }}
            >
              {/* A barrinha do `.nb::after`, encostada ao topo do separador. */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  width: on ? 20 : 0,
                  height: 3,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 3,
                  backgroundColor: t.pr,
                }}
              />
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? alpha(t.pr, 12) : 'transparent',
                  transform: [{ scale: on ? 1.06 : 1 }],
                }}
              >
                {options.tabBarIcon?.({ focused: on, color, size: 20 })}
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
