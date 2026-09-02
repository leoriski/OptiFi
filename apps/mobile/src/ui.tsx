import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type TextInputProps } from 'react-native';
import { Text, TextInput } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EyeIcon } from './icons';
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

/**
 * O `color-mix(... 12%, transparent)` do CSS. Todas as cores do tema são hex de
 * 6 dígitos, por isso basta acrescentar o canal alfa.
 */
export function alpha(hex: string, pct: number): string {
  return hex + Math.round((pct / 100) * 255).toString(16).padStart(2, '0');
}

/**
 * O `Drawer` da web (`.sp-overlay` + `.sp-sheet`): folha que sobe de baixo,
 * ocupa 88% do ecrã e fecha no fundo escuro ou no ✕. Aqui é um `Modal` do
 * React Native, que trata sozinho do botão "voltar" do Android — a tecla
 * Escape do equivalente na web.
 */
export function Sheet({
  t,
  open,
  onClose,
  title,
  sub,
  closeLabel,
  children,
}: {
  t: Theme;
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} onRequestClose={onClose} animationType="slide" transparent statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ height: '88%', backgroundColor: t.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: t.b }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: alpha(t.tx3, 30), alignSelf: 'center', marginTop: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 18, paddingBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: t.tx }}>{title}</Text>
              {sub ? <Text style={{ fontSize: 11, color: t.tx2, marginTop: 1 }}>{sub}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card2, borderWidth: 1, borderColor: t.b }}
            >
              <Text style={{ fontSize: 14, color: t.tx2, lineHeight: 16 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 48 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function ErrorMsg({ t, children }: { t: Theme; children?: string }) {
  if (!children) return null;
  return (
    <View
      style={{
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: t.rs,
        backgroundColor: alpha(t.re, 12),
        borderWidth: 1,
        borderColor: alpha(t.re, 30),
      }}
    >
      <Text style={{ color: t.re, fontSize: 12, fontWeight: '700', lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

export function OkMsg({ t, children }: { t: Theme; children?: string }) {
  if (!children) return null;
  return (
    <View
      style={{
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: t.rs,
        backgroundColor: alpha(t.gr, 12),
        borderWidth: 1,
        borderColor: alpha(t.gr, 30),
      }}
    >
      <Text style={{ color: t.gr, fontSize: 12, fontWeight: '700', lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

export function FieldLabel({ t, children }: { t: Theme; children: ReactNode }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: '700', color: t.tx2, marginTop: 12, marginBottom: 6 }}>
      {children}
    </Text>
  );
}

export function Field({
  t,
  label,
  value,
  onChangeText,
  ...rest
}: { t: Theme; label?: string; value: string; onChangeText: (v: string) => void } & TextInputProps) {
  return (
    <View>
      {label ? <FieldLabel t={t}>{label}</FieldLabel> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={t.tx3}
        {...rest}
        style={[
          {
            backgroundColor: t.bg2,
            borderColor: t.b,
            borderWidth: 1,
            borderRadius: t.rs,
            paddingHorizontal: 14,
            paddingVertical: 13,
            fontSize: 15,
            color: t.tx,
          },
          rest.style,
        ]}
      />
    </View>
  );
}

/**
 * Password com botão para ver o que se escreveu. Escrever às cegas num
 * telemóvel é a principal razão para falhar a criação de conta: erra-se uma
 * tecla, o "confirmar" não bate certo e ninguém percebe porquê.
 */
export function PasswordField({
  t,
  label,
  value,
  onChangeText,
  textContentType,
  onSubmitEditing,
  showLabel,
  hideLabel,
}: {
  t: Theme;
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  textContentType: 'password' | 'newPassword';
  onSubmitEditing?: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View>
      {label ? <FieldLabel t={t}>{label}</FieldLabel> : null}
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={textContentType}
          onSubmitEditing={onSubmitEditing}
          placeholderTextColor={t.tx3}
          style={{
            backgroundColor: t.bg2,
            borderColor: t.b,
            borderWidth: 1,
            borderRadius: t.rs,
            paddingLeft: 14,
            // Espaço à direita para o texto não passar por baixo do botão.
            paddingRight: 48,
            paddingVertical: 13,
            fontSize: 15,
            color: t.tx,
          }}
        />
        <Pressable
          onPress={() => setShow((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={show ? hideLabel : showLabel}
          hitSlop={6}
          style={{
            position: 'absolute',
            right: 0,
            width: 48,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EyeIcon color={show ? t.pr : t.tx3} off={show} />
        </Pressable>
      </View>
    </View>
  );
}

/** Link de texto — o `<Link>` da web, que aqui não existe. */
export function LinkText({
  t,
  label,
  onPress,
  align = 'center',
}: {
  t: Theme;
  label: string;
  onPress: () => void;
  align?: 'center' | 'left';
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ alignSelf: align === 'center' ? 'center' : 'flex-start' }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: t.pr }}>{label}</Text>
    </Pressable>
  );
}

/**
 * O `AuthCard` da web. O teclado empurra o conteúdo em vez de o tapar: num
 * telemóvel o campo da password fica por baixo do teclado se ninguém tratar
 * disso.
 */
export function AuthShell({
  t,
  title,
  sub,
  children,
}: {
  t: Theme;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Screen t={t}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 18,
            paddingTop: insets.top + 18,
            paddingBottom: insets.bottom + 18,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Card t={t} style={{ padding: 22 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: t.pr, letterSpacing: -0.6 }}>OptiFi</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: t.tx, marginTop: 10 }}>{title}</Text>
            {sub ? <Text style={{ fontSize: 13, color: t.tx2, lineHeight: 19, marginTop: 4 }}>{sub}</Text> : null}
            <View style={{ marginTop: 6 }}>{children}</View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
