import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from './theme';

/** O `.card` do prototype.css: superfície neutra, borda fina, sem gradiente. */
export function Card({ t, children, style }: { t: Theme; children: ReactNode; style?: object }) {
  return (
    <View
      style={[
        { backgroundColor: t.card, borderColor: t.b, borderWidth: 1, borderRadius: t.r, padding: 15 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  t,
  label,
  onPress,
  loading,
  disabled,
  variant = 'solid',
}: {
  t: Theme;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'ghost';
}) {
  const off = disabled || loading;
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => ({
        backgroundColor: solid ? t.pr : 'transparent',
        borderColor: solid ? t.pr : t.b,
        borderWidth: 1,
        borderRadius: t.rs,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={solid ? '#fff' : t.tx} />
      ) : (
        <Text style={{ color: solid ? '#fff' : t.tx, fontSize: 15, fontWeight: '800' }}>{label}</Text>
      )}
    </Pressable>
  );
}

/** O `.sec`: rótulo de secção, maiúsculas e espaçado. */
export function SectionLabel({ t, children }: { t: Theme; children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: t.tx3,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        marginBottom: 9,
      }}
    >
      {children}
    </Text>
  );
}

export function Screen({ t, children }: { t: Theme; children: ReactNode }) {
  return <View style={[styles.screen, { backgroundColor: t.bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
