// Perfil — a mesma estrutura da web: cartão de perfil (iniciais, nome, email,
// badge de beta), listas de definições que abrem folhas (Idioma, Nome, Tema,
// Segurança, Notificações, Ajuda, Sobre), e Sair + Eliminar conta no fundo.
//
// O que não veio da web, e porquê: só o push do browser — aqui seria
// `expo-notifications`, que não funciona no Expo Go e obrigava a uma build
// própria. Em troca, a Segurança tem o Face ID, que só faz sentido no
// telemóvel. O exportar dados veio, mas lido do próprio aparelho em vez da
// rota `/api/export`.

import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { Text } from '../../src/Text';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { DictKey } from '@optifi/core';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/session';
import { useI18n } from '../../src/lib/i18n';
import { useLock } from '../../src/lib/lock';
import { useTheme, useThemeControls, type Accent, type Mode } from '../../src/lib/theme-context';
import { fill } from '@optifi/core';
import { alpha, Button, Card, ErrorMsg, Field, OkMsg, PasswordField, Screen, Sheet } from '../../src/ui';

const APP_VERSION = '0.1.0-beta';
const SUPPORT_EMAIL = 'synamade12@gmail.com';
const PRIVACY_URL = 'https://opti-fi-web-opti-fi1.vercel.app/privacidade';
const TERMS_URL = 'https://opti-fi-web-opti-fi1.vercel.app/termos';

type SheetId = null | 'lang' | 'name' | 'theme' | 'security' | 'notif' | 'help' | 'about';

/** As mesmas tabelas que a rota `/api/export` da web percorre. */
const EXPORT_TABLES = [
  'profiles',
  'imports',
  'transactions',
  'subscriptions',
  'goals',
  'goal_withdrawals',
  'goal_monthly_allocations',
  'category_limits',
  'category_rules',
  'manual_entries',
  'plan_items',
] as const;

// O verde vem primeiro por ser o padrão da app. Na web cada bola era um
// gradiente CSS; aqui é a cor sólida do accent, que é o que ele de facto usa.
const ACCENT_LIST: { id: Accent; labelKey: DictKey; swatch: string }[] = [
  { id: 'emerald', labelKey: 'accent_emerald', swatch: '#10B981' },
  { id: 'brand', labelKey: 'accent_brand', swatch: '#9AA7BD' },
  { id: 'amber', labelKey: 'accent_amber', swatch: '#F59E0B' },
  { id: 'violet', labelKey: 'accent_violet', swatch: '#7C5CFF' },
];

const S = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function ItemIcon({ kind, color }: { kind: Exclude<SheetId, null>; color: string }) {
  const paths: Record<string, React.ReactNode> = {
    lang: (
      <>
        <Circle cx="12" cy="12" r="9" stroke={color} {...S} />
        <Path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" stroke={color} {...S} />
      </>
    ),
    name: (
      <>
        <Circle cx="12" cy="8" r="4" stroke={color} {...S} />
        <Path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" stroke={color} {...S} />
      </>
    ),
    theme: (
      <>
        <Circle cx="12" cy="12" r="9" stroke={color} {...S} />
        <Circle cx="9" cy="10" r="1" stroke={color} {...S} />
        <Circle cx="15" cy="10" r="1" stroke={color} {...S} />
        <Path d="M8.5 15a4.5 4.5 0 0 0 7 0" stroke={color} {...S} />
      </>
    ),
    security: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} {...S} />,
    notif: (
      <>
        <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} {...S} />
        <Path d="M13.7 21a2 2 0 0 1-3.4 0" stroke={color} {...S} />
      </>
    ),
    help: <Path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.2A8 8 0 1 1 21 12Z" stroke={color} {...S} />,
    about: (
      <>
        <Circle cx="12" cy="12" r="9" stroke={color} {...S} />
        <Path d="M12 8h.01M12 11v5" stroke={color} {...S} />
      </>
    ),
  };
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {paths[kind]}
    </Svg>
  );
}

function SettingsItem({
  kind,
  title,
  sub,
  onPress,
  last,
}: {
  kind: Exclude<SheetId, null>;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}) {
  const t0 = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 13,
        paddingHorizontal: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t0.b,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t0.tx2, 14) }}>
        <ItemIcon kind={kind} color={t0.tx2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: t0.tx }}>{title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: t0.tx2, marginTop: 1 }}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: t0.tx3 }}>›</Text>
    </Pressable>
  );
}

export default function Perfil() {
  const t0 = useTheme();
  const router = useRouter();
  const { session, signOut } = useSession();
  const { t, lang, setLang } = useI18n();
  const lock = useLock();
  const { mode, accent, setMode, setAccent } = useThemeControls();

  const [sheet, setSheet] = useState<SheetId>(null);
  const [name, setName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [tipOn, setTipOn] = useState(true);

  // Segurança: palavra-passe
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [pwdOk, setPwdOk] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Segurança: 2FA
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [secErr, setSecErr] = useState('');

  const [exportErr, setExportErr] = useState('');

  // Eliminar conta
  const [deleting, setDeleting] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleteErr, setDeleteErr] = useState('');

  const email = session?.user.email ?? '';

  const refreshFactors = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp?.find((f) => f.status === 'verified')?.id ?? null);
  }, []);

  useEffect(() => {
    void refreshFactors();
    void supabase
      .from('profiles')
      .select('name,daily_tips')
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0];
        const n = (row?.name as string | null) ?? '';
        setName(n);
        setNameDraft(n);
        setTipOn(row?.daily_tips !== false);
      });
  }, [refreshFactors]);

  /**
   * Exportar dados (RGPD, art. 20.º). Na web isto é a rota `/api/export`; aqui
   * é lido do próprio telemóvel com o login do utilizador — o RLS do Supabase
   * devolve só as linhas dele, exatamente como faria do lado do servidor. Fica
   * um ficheiro em disco que a folha de partilha do sistema entrega onde ele
   * quiser (mail, Ficheiros, Drive).
   */
  async function exportData() {
    setExportErr('');
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const payload: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        account: { id: u.user.id, email: u.user.email, created_at: u.user.created_at },
      };
      for (const table of EXPORT_TABLES) {
        const { data, error } = await supabase.from(table).select('*');
        payload[table] = error ? { error: error.message } : data;
      }
      const file = new File(Paths.cache, `optifi-dados-${new Date().toISOString().slice(0, 10)}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(payload, null, 2));
      if (!(await Sharing.isAvailableAsync())) {
        setExportErr(t('sec_export_failed'));
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    } catch {
      setExportErr(t('sec_export_failed'));
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from('profiles').update({ name: nameDraft.trim() }).eq('id', data.user.id);
    setName(nameDraft.trim());
    setSheet(null);
  }

  // A dica é enviada pelo servidor, não desenhada no telemóvel — a preferência
  // tem de estar na base para o servidor a conseguir ler.
  async function toggleTip() {
    const next = !tipOn;
    setTipOn(next);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from('profiles').update({ daily_tips: next }).eq('id', data.user.id);
    if (error) setTipOn(!next);
  }

  async function changePassword() {
    setPwdOk('');
    setPwdErr('');
    if (pwd.length < 8) {
      setPwdErr(t('auth_pwd_short'));
      return;
    }
    if (pwd !== pwd2) {
      setPwdErr(t('auth_pwd_mismatch'));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) {
      setPwdErr(t('auth_error_generic'));
      return;
    }
    setPwd('');
    setPwd2('');
    setPwdOk(t('pwd_ok'));
  }

  async function startEnroll() {
    setSecErr('');
    setBusy(true);
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'OptiFi' });
    setBusy(false);
    if (error || !data) {
      setSecErr(t('auth_error_generic'));
      return;
    }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode('');
  }

  async function confirmEnroll() {
    if (!enrolling || code.length !== 6) return;
    setSecErr('');
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (chErr || !ch) {
      setBusy(false);
      setSecErr(t('auth_error_generic'));
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrolling.factorId, challengeId: ch.id, code });
    setBusy(false);
    if (error) {
      setSecErr(t('sec_2fa_bad_code'));
      return;
    }
    setEnrolling(null);
    setCode('');
    await refreshFactors();
  }

  async function disable2fa() {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      setSecErr(t('auth_error_generic'));
      return;
    }
    await refreshFactors();
  }

  // Apagar a conta são dois passos seguidos, como na web: o segundo obriga a
  // escrever a palavra, para ninguém lá chegar por engano. Na web eram um
  // `confirm()` e um `prompt()`; aqui o segundo é uma folha, porque o
  // `Alert.prompt` do React Native só existe no iOS.
  function askDelete() {
    Alert.alert(t('profile_delete_link'), t('sec_delete_confirm1'), [
      { text: t('goal_cancel'), style: 'cancel' },
      { text: t('profile_delete_link'), style: 'destructive', onPress: () => setDeleting(true) },
    ]);
  }

  async function confirmDelete() {
    if (deleteWord.trim().toLowerCase() !== t('sec_delete_word').toLowerCase()) {
      setDeleteErr(t('sec_delete_confirm2'));
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('delete_own_account');
    setBusy(false);
    if (error) {
      setDeleteErr(t('sec_delete_failed'));
      return;
    }
    setDeleting(false);
    await signOut();
    router.replace('/login');
  }

  const initials = (name || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  const accentLabel = t(ACCENT_LIST.find((a) => a.id === accent)?.labelKey ?? 'accent_emerald');
  const modeLabel = t(mode === 'dark' ? 'profile_mode_dark' : 'profile_mode_light');

  const pill = (active: boolean, label: string, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: t0.rs,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: active ? t0.pr : t0.b,
        backgroundColor: active ? t0.pr : t0.card2,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '800', color: active ? '#fff' : t0.tx2 }}>{label}</Text>
    </Pressable>
  );

  /** O QR do 2FA vem como SVG dentro de um data URI; o `<Image>` do RN não o
      desenha, mas o react-native-svg desenha o SVG em si. */
  const qrXml = enrolling ? decodeURIComponent(enrolling.qr.replace(/^data:image\/svg\+xml[;,]?(utf-8)?,?/, '')) : '';

  return (
    <Screen t={t0}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13, paddingBottom: 28 }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5, marginBottom: 2 }}>
          {t('profile_title')}
        </Text>
        <Text style={{ fontSize: 12, color: t0.tx2, marginBottom: 13 }}>{t('profile_page_sub')}</Text>

        {/* Cartão de perfil */}
        <Card t={t0} style={{ marginBottom: 11, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 16 }}>
          <View style={{ width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: t0.pr }}>
            <Text style={{ fontSize: 21, fontWeight: '900', color: '#fff' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '900', color: t0.tx }}>{name || t('si_name_unset')}</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: t0.tx2, marginTop: 2, marginBottom: 7 }}>{email}</Text>
            <View
              style={{
                alignSelf: 'flex-start',
                paddingVertical: 3,
                paddingHorizontal: 10,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: alpha(t0.pr, 40),
                backgroundColor: alpha(t0.pr, 10),
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: t0.pr }}>{t('profile_beta_badge')}</Text>
            </View>
          </View>
          <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t0.card2, borderWidth: 1, borderColor: t0.b }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx2 }}>{lang.toUpperCase()}</Text>
          </View>
        </Card>

        {/* Lista de definições */}
        <Card t={t0} style={{ marginBottom: 11, padding: 0, overflow: 'hidden' }}>
          <SettingsItem kind="lang" title={t('si_lang')} sub={`${lang.toUpperCase()} · € EUR`} onPress={() => setSheet('lang')} />
          <SettingsItem kind="name" title={t('si_name')} sub={name || t('si_name_unset')} onPress={() => setSheet('name')} />
          <SettingsItem kind="theme" title={t('si_theme')} sub={`${modeLabel}${t('theme_sub_sep')}${accentLabel}`} onPress={() => setSheet('theme')} />
          <SettingsItem kind="security" title={t('si_security')} sub={t('si_security_sub')} onPress={() => setSheet('security')} />
          <SettingsItem kind="notif" title={t('si_notif')} sub={t('si_notif_sub')} onPress={() => setSheet('notif')} last />
        </Card>

        <Card t={t0} style={{ marginBottom: 11, padding: 0, overflow: 'hidden' }}>
          <SettingsItem kind="help" title={t('si_help')} sub={t('si_help_sub')} onPress={() => setSheet('help')} />
          <SettingsItem kind="about" title={t('si_about')} sub={fill(t('si_about_sub'), { v: APP_VERSION })} onPress={() => setSheet('about')} last />
        </Card>

        {/* Sair + eliminar conta */}
        <Pressable
          onPress={() => void signOut()}
          style={{
            paddingVertical: 14,
            marginTop: 4,
            alignItems: 'center',
            borderRadius: t0.r,
            borderWidth: 1,
            borderColor: alpha(t0.re, 35),
            backgroundColor: alpha(t0.re, 6),
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: t0.re }}>{t('profile_logout')}</Text>
        </Pressable>
        <Pressable onPress={askDelete} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx3 }}>{t('profile_delete_link')}</Text>
        </Pressable>
      </ScrollView>

      {/* ── Folhas ── */}
      <Sheet t={t0} open={sheet === 'lang'} onClose={() => setSheet(null)} title={t('si_lang')} closeLabel={t('goal_cancel')}>
        <Card t={t0}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {pill(lang === 'pt', t('lang_pt'), () => setLang('pt'))}
            {pill(lang === 'en', t('lang_en'), () => setLang('en'))}
          </View>
        </Card>
      </Sheet>

      <Sheet t={t0} open={sheet === 'name'} onClose={() => setSheet(null)} title={t('si_name')} sub={t('nd_sub')} closeLabel={t('goal_cancel')}>
        <Card t={t0}>
          <Field t={t0} value={nameDraft} onChangeText={setNameDraft} placeholder={t('nd_placeholder')} />
          <View style={{ height: 10 }} />
          <Button t={t0} label={t('goal_save')} onPress={() => void saveName()} />
        </Card>
      </Sheet>

      <Sheet t={t0} open={sheet === 'theme'} onClose={() => setSheet(null)} title={t('si_theme')} closeLabel={t('goal_cancel')}>
        <Card t={t0}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx2, marginBottom: 8 }}>{t('profile_theme_mode')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* O claro vem primeiro por ser o padrão da app. */}
            {pill(mode === 'light', t('profile_mode_light'), () => setMode('light' as Mode))}
            {pill(mode === 'dark', t('profile_mode_dark'), () => setMode('dark' as Mode))}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx2, marginTop: 16, marginBottom: 8 }}>{t('profile_theme_accent')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {ACCENT_LIST.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAccent(a.id)}
                accessibilityRole="button"
                accessibilityLabel={t(a.labelKey)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: a.swatch,
                  borderWidth: 3,
                  borderColor: accent === a.id ? t0.tx : 'transparent',
                }}
              />
            ))}
          </View>
        </Card>
      </Sheet>

      <Sheet t={t0} open={sheet === 'security'} onClose={() => setSheet(null)} title={t('si_security')} sub={t('si_security_sub')} closeLabel={t('goal_cancel')}>
        {/* Face ID — não existe na web, mas é a fechadura desta app. */}
        <Card t={t0} style={{ marginBottom: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx }}>{t('lock_toggle')}</Text>
              <Text style={{ fontSize: 11, color: t0.tx2, lineHeight: 16, marginTop: 2 }}>
                {lock.available ? t('lock_toggle_on_sub') : t('lock_toggle_off_sub')}
              </Text>
            </View>
            <Switch
              value={lock.enabled}
              disabled={!lock.available}
              onValueChange={(v) => void lock.setEnabled(v)}
              trackColor={{ true: t0.pr, false: t0.b }}
            />
          </View>
        </Card>

        {/* Alterar palavra-passe */}
        <Card t={t0} style={{ marginBottom: 11 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx2, marginBottom: 9 }}>{t('pwd_change')}</Text>
          <PasswordField
            t={t0}
            value={pwd}
            onChangeText={setPwd}
            textContentType="newPassword"
            showLabel={t('auth_pwd_show')}
            hideLabel={t('auth_pwd_hide')}
          />
          <View style={{ height: 8 }} />
          <PasswordField
            t={t0}
            value={pwd2}
            onChangeText={setPwd2}
            textContentType="newPassword"
            showLabel={t('auth_pwd_show')}
            hideLabel={t('auth_pwd_hide')}
          />
          <ErrorMsg t={t0}>{pwdErr}</ErrorMsg>
          <OkMsg t={t0}>{pwdOk}</OkMsg>
          <View style={{ height: 10 }} />
          <Button t={t0} label={t('auth_update_pwd_btn')} onPress={() => void changePassword()} disabled={busy} variant="ghost" />
        </Card>

        {/* 2FA */}
        <Card t={t0}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx2 }}>{t('sec_2fa')}</Text>
            <Text style={{ fontSize: 11, fontWeight: '800', color: factorId ? t0.tx : t0.tx3 }}>
              {factorId ? t('sec_2fa_on') : t('sec_2fa_off')}
            </Text>
          </View>
          {!enrolling && !factorId ? (
            <Button t={t0} label={t('sec_2fa_enable')} onPress={() => void startEnroll()} disabled={busy} variant="ghost" />
          ) : null}
          {!enrolling && factorId ? (
            <Button t={t0} label={t('sec_2fa_disable')} onPress={() => void disable2fa()} disabled={busy} variant="ghost" />
          ) : null}
          {enrolling ? (
            <View>
              <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18, marginBottom: 10 }}>{t('sec_2fa_scan')}</Text>
              {qrXml.startsWith('<svg') ? (
                <View style={{ alignItems: 'center', marginBottom: 10, backgroundColor: '#fff', borderRadius: 8, padding: 6, alignSelf: 'center' }}>
                  <SvgXml xml={qrXml} width={168} height={168} />
                </View>
              ) : null}
              <Text style={{ fontSize: 10, color: t0.tx3, marginBottom: 2 }}>{t('sec_2fa_secret')}</Text>
              <Text selectable style={{ fontSize: 11, color: t0.tx2, marginBottom: 10 }}>{enrolling.secret}</Text>
              <Field
                t={t0}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder={t('sec_2fa_code')}
              />
              <View style={{ height: 8 }} />
              <Button t={t0} label={t('sec_2fa_confirm')} onPress={() => void confirmEnroll()} disabled={busy || code.length !== 6} />
            </View>
          ) : null}
          <ErrorMsg t={t0}>{secErr}</ErrorMsg>
        </Card>

        {/* Dados (RGPD) */}
        <Card t={t0} style={{ marginTop: 11 }}>
          <Button t={t0} label={t('sec_export')} onPress={() => void exportData()} disabled={busy} variant="ghost" />
          <ErrorMsg t={t0}>{exportErr}</ErrorMsg>
        </Card>
      </Sheet>

      <Sheet t={t0} open={sheet === 'notif'} onClose={() => setSheet(null)} title={t('si_notif')} sub={t('notif_note')} closeLabel={t('goal_cancel')}>
        <Card t={t0}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: t0.tx }}>{t('notif_tip')}</Text>
            <Switch value={tipOn} onValueChange={() => void toggleTip()} trackColor={{ true: t0.pr, false: t0.b }} />
          </View>
        </Card>
      </Sheet>

      <Sheet t={t0} open={sheet === 'help'} onClose={() => setSheet(null)} title={t('si_help')} closeLabel={t('goal_cancel')}>
        <Card t={t0}>
          <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 21, marginBottom: 14 }}>{t('help_text')}</Text>
          <Button
            t={t0}
            label={t('help_email_btn')}
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=OptiFi%20Beta`)}
          />
        </Card>
      </Sheet>

      <Sheet
        t={t0}
        open={sheet === 'about'}
        onClose={() => setSheet(null)}
        title={t('si_about')}
        sub={fill(t('si_about_sub'), { v: APP_VERSION })}
        closeLabel={t('goal_cancel')}
      >
        <Card t={t0}>
          <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 21, marginBottom: 14 }}>{t('about_desc')}</Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={6}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: t0.pr }}>{t('sec_privacy')}</Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL(TERMS_URL)} hitSlop={6}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: t0.pr }}>{t('sec_terms')}</Text>
            </Pressable>
          </View>
        </Card>
      </Sheet>
      <Sheet
        t={t0}
        open={deleting}
        onClose={() => {
          setDeleting(false);
          setDeleteWord('');
          setDeleteErr('');
        }}
        title={t('profile_delete_link')}
        closeLabel={t('goal_cancel')}
      >
        <Card t={t0}>
          <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 20, marginBottom: 12 }}>{t('sec_delete_confirm2')}</Text>
          <Field t={t0} value={deleteWord} onChangeText={setDeleteWord} autoCapitalize="none" autoCorrect={false} placeholder={t('sec_delete_word')} />
          <ErrorMsg t={t0}>{deleteErr}</ErrorMsg>
          <View style={{ height: 12 }} />
          <Button t={t0} label={t('profile_delete_link')} onPress={() => void confirmDelete()} disabled={busy} />
          <View style={{ height: 8 }} />
          <Button t={t0} label={t('goal_cancel')} onPress={() => setDeleting(false)} variant="ghost" />
        </Card>
      </Sheet>
    </Screen>
  );
}
