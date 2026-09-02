import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, Path } from 'react-native-svg';
import { Text } from './Text';
import { useI18n } from './lib/i18n';
import { useTheme } from './lib/theme-context';

/**
 * O `.hdr` da web: logótipo OptiFi à esquerda, selo "Seguro" à direita.
 *
 * Na web é `position: sticky` e vive no AppShell; aqui vive por cima dos
 * separadores, e é ele que come a margem do notch — os ecrãs por baixo já não
 * precisam de a somar ao seu padding.
 */
export function OptiFiLogo({ size = 21, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <ClipPath id="optifiLogoClip">
          <Circle cx="16" cy="16" r="14" />
        </ClipPath>
      </Defs>
      <Circle cx="16" cy="16" r="15" fill="none" stroke={color} strokeWidth={1.5} />
      <Path
        d="M 8 16 A 8 8 0 0 1 24 16"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        clipPath="url(#optifiLogoClip)"
      />
      <Path
        d="M 7 17 C 10 17, 11 12, 13 14 C 15 16, 16 11, 18 13 C 20 15, 21 19, 24 18"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath="url(#optifiLogoClip)"
      />
    </Svg>
  );
}

export function AppHeader() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { lang } = useI18n();
  return (
    <View
      style={{
        backgroundColor: t.bg2,
        borderBottomWidth: 1,
        borderBottomColor: t.b,
        paddingTop: insets.top + 9,
        paddingBottom: 9,
        paddingHorizontal: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 29, height: 29, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <OptiFiLogo color={t.tx} />
        </View>
        {/* O protótipo tinha o wordmark em gradiente; o globals.css passou-o a
            monocromático, e é essa a versão em vigor. */}
        <Text style={{ fontSize: 18, fontWeight: '900', letterSpacing: -0.5, color: t.tx }}>OptiFi</Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingVertical: 4,
          paddingHorizontal: 9,
          borderRadius: 20,
          backgroundColor: t.card2,
          borderWidth: 1,
          borderColor: t.b,
        }}
      >
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            fill="none"
            stroke={t.tx2}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t.tx2 }}>{lang === 'pt' ? 'Seguro' : 'Secure'}</Text>
      </View>
    </View>
  );
}
