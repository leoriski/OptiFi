'use client';

// Perfil — estrutura do protótipo: cartão de perfil (avatar com iniciais,
// nome, email, badge), lista de definições com drawers (Idioma, Nome, Tema,
// Segurança, Notificações, Ajuda, Sobre), Sair e Eliminar Conta no fundo.
// Sem "Saúde Financeira" (removida a pedido do produto).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useI18n, type DictKey } from '@/lib/i18n';
import { fill } from '@/lib/format';
import { Drawer } from '@/components/Drawer';
import { SecuritySection } from '@/components/SecuritySection';
import { pushSupported, isPushEnabled, enablePush, disablePush } from '@/lib/push';

const APP_VERSION = '0.1.0-beta';
const SUPPORT_EMAIL = 'synamade12@gmail.com';

type Mode = 'dark' | 'light';
type Accent = 'brand' | 'amber' | 'violet' | 'emerald';
type DrawerId = null | 'lang' | 'name' | 'theme' | 'security' | 'notif' | 'help' | 'about';

const ACCENTS: { id: Accent; labelKey: DictKey; swatch: string }[] = [
  { id: 'brand', labelKey: 'accent_brand', swatch: 'linear-gradient(135deg,#0f1623,#9aa7bd)' },
  { id: 'amber', labelKey: 'accent_amber', swatch: 'linear-gradient(135deg,#F59E0B,#FFC44D)' },
  { id: 'violet', labelKey: 'accent_violet', swatch: 'linear-gradient(135deg,#7C5CFF,#B794FF)' },
  { id: 'emerald', labelKey: 'accent_emerald', swatch: 'linear-gradient(135deg,#10B981,#5EEAD4)' },
];

const ICON_STROKE = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function ItemIcon({ kind }: { kind: Exclude<DrawerId, null> }) {
  const conf: Record<string, { color: string; path: React.ReactNode }> = {
    lang: {
      color: 'var(--tx2)',
      path: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
        </>
      ),
    },
    name: {
      color: 'var(--tx2)',
      path: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
        </>
      ),
    },
    theme: {
      color: 'var(--tx2)',
      path: (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="9" cy="10" r="1" />
          <circle cx="15" cy="10" r="1" />
          <path d="M8.5 15a4.5 4.5 0 0 0 7 0" />
        </>
      ),
    },
    security: {
      color: 'var(--tx2)',
      path: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    },
    notif: {
      color: 'var(--tx2)',
      path: (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </>
      ),
    },
    help: {
      color: 'var(--tx2)',
      path: <path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.2A8 8 0 1 1 21 12Z" />,
    },
    about: {
      color: 'var(--tx2)',
      path: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M12 11v5" />
        </>
      ),
    },
  };
  const c = conf[kind]!;
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: `color-mix(in srgb, ${c.color} 14%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" stroke={c.color} {...ICON_STROKE}>
        {c.path}
      </svg>
    </div>
  );
}

function SettingsItem({ kind, title, sub, onClick, trailing }: { kind: Exclude<DrawerId, null>; title: string; sub: string; onClick: () => void; trailing?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        width: '100%',
        padding: '13px 15px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--b)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'Inter,sans-serif',
      }}
    >
      <ItemIcon kind={kind} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 1 }}>{sub}</div>
      </div>
      {trailing}
      <span style={{ color: 'var(--tx3)', fontSize: 17, fontWeight: 700 }}>›</span>
    </button>
  );
}

export default function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [mode, setMode] = useState<Mode>('dark');
  const [accent, setAccent] = useState<Accent>('brand');
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [tipOn, setTipOn] = useState(true);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');
  // Só se sabe se o browser suporta push DEPOIS de montar (não no servidor) —
  // começar em false garante que o HTML do servidor e do cliente coincidem
  // (evita o hydration mismatch no toggle).
  const [pushCanUse, setPushCanUse] = useState(false);
  useEffect(() => {
    setPushCanUse(pushSupported());
    void isPushEnabled().then(setPushOn);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    setMode(root.getAttribute('data-mode') === 'light' ? 'light' : 'dark');
    const a = root.getAttribute('data-accent') as Accent | null;
    setAccent(a && ['brand', 'amber', 'violet', 'emerald'].includes(a) ? a : 'brand');
    setTipOn(localStorage.getItem('optifi_tip_home') !== 'off');
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
    void supabase
      .from('profiles')
      .select('name')
      .limit(1)
      .then(({ data }) => {
        const n = (data?.[0]?.name as string | null) ?? '';
        setName(n);
        setNameDraft(n);
      });
  }, []);

  function applyMode(m: Mode) {
    document.documentElement.setAttribute('data-mode', m);
    localStorage.setItem('optifi_mode', m);
    setMode(m);
  }

  function applyAccent(a: Accent) {
    document.documentElement.setAttribute('data-accent', a);
    localStorage.setItem('optifi_accent', a);
    setAccent(a);
  }

  async function saveName() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ name: nameDraft.trim() }).eq('id', user.id);
    setName(nameDraft.trim());
    setDrawer(null);
  }

  function toggleTip() {
    const next = !tipOn;
    setTipOn(next);
    localStorage.setItem('optifi_tip_home', next ? 'on' : 'off');
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function deleteAccount() {
    if (!window.confirm(t('sec_delete_confirm1'))) return;
    const word = window.prompt(t('sec_delete_confirm2'));
    if (word !== t('sec_delete_word')) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      window.alert(t('sec_delete_failed'));
      return;
    }
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = (name || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  const accentLabel = t(ACCENTS.find((a) => a.id === accent)?.labelKey ?? 'accent_brand');
  const modeLabel = t(mode === 'dark' ? 'profile_mode_dark' : 'profile_mode_light');

  const pill = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: 10,
    borderRadius: 'var(--rs)',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'Inter,sans-serif',
    background: active ? 'var(--pr)' : 'var(--card2)',
    color: active ? 'var(--bg)' : 'var(--tx2)',
    border: active ? '1px solid transparent' : '1px solid var(--b)',
  });

  const group: React.CSSProperties = { padding: 0, overflow: 'hidden' };

  return (
    <>
      <div className="ptitle">{t('profile_title')}</div>
      <div className="psub">{t('profile_page_sub')}</div>

      {/* Cartão de perfil */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 16px' }}>
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: '50%',
            background: 'var(--pr)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 21,
            fontWeight: 900,
            color: 'var(--bg)',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{name || t('si_name_unset')}</div>
          <div style={{ fontSize: 12, color: 'var(--tx2)', margin: '2px 0 7px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--pr)',
              border: '1px solid color-mix(in srgb, var(--pr) 40%, transparent)',
              background: 'color-mix(in srgb, var(--pr) 10%, transparent)',
              padding: '3px 10px',
              borderRadius: 20,
            }}
          >
            {t('profile_beta_badge')}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--tx2)',
            background: 'var(--card2)',
            border: '1px solid var(--b)',
            padding: '6px 12px',
            borderRadius: 12,
          }}
        >
          {lang.toUpperCase()}
        </div>
      </div>

      {/* Lista de definições */}
      <div className="card" style={group}>
        <SettingsItem kind="lang" title={t('si_lang')} sub={`${lang.toUpperCase()} · € EUR`} onClick={() => setDrawer('lang')} />
        <SettingsItem kind="name" title={t('si_name')} sub={name || t('si_name_unset')} onClick={() => setDrawer('name')} />
        <SettingsItem kind="theme" title={t('si_theme')} sub={`${modeLabel}${t('theme_sub_sep')}${accentLabel}`} onClick={() => setDrawer('theme')} />
        <SettingsItem kind="security" title={t('si_security')} sub={t('si_security_sub')} onClick={() => setDrawer('security')} />
        <SettingsItem kind="notif" title={t('si_notif')} sub={t('si_notif_sub')} onClick={() => setDrawer('notif')} />
      </div>

      <div className="card" style={group}>
        <SettingsItem kind="help" title={t('si_help')} sub={t('si_help_sub')} onClick={() => setDrawer('help')} />
        <SettingsItem kind="about" title={t('si_about')} sub={fill(t('si_about_sub'), { v: APP_VERSION })} onClick={() => setDrawer('about')} />
      </div>

      {/* Sair + Eliminar conta */}
      <button
        onClick={() => void logout()}
        style={{
          width: '100%',
          padding: 14,
          marginTop: 4,
          background: 'color-mix(in srgb, var(--re) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--re) 35%, transparent)',
          borderRadius: 'var(--r)',
          color: 'var(--re)',
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'Inter,sans-serif',
        }}
      >
        [→ {t('profile_logout')}
      </button>
      <button
        onClick={() => void deleteAccount()}
        style={{
          display: 'block',
          margin: '14px auto 0',
          background: 'none',
          border: 'none',
          color: 'var(--tx3)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'Inter,sans-serif',
        }}
      >
        {t('profile_delete_link')}
      </button>

      {/* ── Drawers ── */}
      <Drawer open={drawer === 'lang'} onClose={() => setDrawer(null)} title={t('si_lang')}>
        <div className="card">
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={pill(lang === 'pt')} onClick={() => setLang('pt')}>
              {t('lang_pt')}
            </button>
            <button style={pill(lang === 'en')} onClick={() => setLang('en')}>
              {t('lang_en')}
            </button>
          </div>
        </div>
      </Drawer>

      <Drawer open={drawer === 'name'} onClose={() => setDrawer(null)} title={t('si_name')} sub={t('nd_sub')}>
        <div className="card">
          <input className="auth-input" placeholder={t('nd_placeholder')} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn-primary" style={{ padding: 12, fontSize: 13 }} onClick={() => void saveName()}>
            {t('goal_save')}
          </button>
        </div>
      </Drawer>

      <Drawer open={drawer === 'theme'} onClose={() => setDrawer(null)} title={t('si_theme')}>
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx2)', marginBottom: 8 }}>{t('profile_theme_mode')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={pill(mode === 'dark')} onClick={() => applyMode('dark')}>
              {t('profile_mode_dark')}
            </button>
            <button style={pill(mode === 'light')} onClick={() => applyMode('light')}>
              {t('profile_mode_light')}
            </button>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx2)', margin: '16px 0 8px' }}>{t('profile_theme_accent')}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => applyAccent(a.id)}
                aria-label={t(a.labelKey)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: a.swatch,
                  cursor: 'pointer',
                  border: accent === a.id ? '3px solid var(--tx)' : '3px solid transparent',
                }}
              />
            ))}
          </div>
        </div>
      </Drawer>

      <Drawer open={drawer === 'security'} onClose={() => setDrawer(null)} title={t('si_security')} sub={t('si_security_sub')}>
        <SecuritySection />
      </Drawer>

      <Drawer open={drawer === 'notif'} onClose={() => setDrawer(null)} title={t('si_notif')} sub={t('notif_note')}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 12px', borderBottom: '1px solid var(--b)' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t('notif_tip')}</span>
            <button
              onClick={toggleTip}
              aria-pressed={tipOn}
              style={{
                width: 46,
                height: 26,
                borderRadius: 13,
                border: 'none',
                cursor: 'pointer',
                background: tipOn ? 'var(--pr)' : 'var(--b)',
                position: 'relative',
                transition: 'background .2s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: tipOn ? 23 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--bg)',
                  transition: 'left .2s',
                }}
              />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t('notif_push')}</span>
            <button
              disabled={pushBusy || !pushCanUse}
              onClick={async () => {
                setPushBusy(true);
                setPushMsg('');
                if (pushOn) {
                  await disablePush();
                  setPushOn(false);
                } else {
                  const r = await enablePush();
                  if (r === 'ok') setPushOn(true);
                  else setPushMsg(t(r === 'denied' ? 'notif_push_denied' : r === 'unsupported' ? 'notif_push_unsupported' : 'notif_push_error'));
                }
                setPushBusy(false);
              }}
              aria-pressed={pushOn}
              style={{ width: 46, height: 26, borderRadius: 13, border: 'none', cursor: pushCanUse ? 'pointer' : 'default', background: pushOn ? 'var(--pr)' : 'var(--b)', position: 'relative', transition: 'background .2s', opacity: pushCanUse ? 1 : 0.5 }}
            >
              <span style={{ position: 'absolute', top: 3, left: pushOn ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bg)', transition: 'left .2s' }} />
            </button>
          </div>
          {pushOn && (
            <button
              className="btn-secondary"
              style={{ marginTop: 10, padding: 9, fontSize: 12 }}
              onClick={async () => {
                setPushMsg('');
                const res = await fetch('/api/push/test', { method: 'POST' });
                setPushMsg(res.ok ? t('notif_push_test_ok') : t('notif_push_test_fail'));
              }}
            >
              {t('notif_push_test')}
            </button>
          )}
          {pushMsg && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--tx2)' }}>{pushMsg}</div>}
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--tx3)', lineHeight: 1.5 }}>{t('notif_push_note')}</div>
        </div>
      </Drawer>

      <Drawer open={drawer === 'help'} onClose={() => setDrawer(null)} title={t('si_help')}>
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 14 }}>{t('help_text')}</div>
          <a className="btn-primary" style={{ padding: 12, fontSize: 13, textDecoration: 'none' }} href={`mailto:${SUPPORT_EMAIL}?subject=OptiFi%20Beta`}>
            {t('help_email_btn')}
          </a>
        </div>
      </Drawer>

      <Drawer open={drawer === 'about'} onClose={() => setDrawer(null)} title={t('si_about')} sub={fill(t('si_about_sub'), { v: APP_VERSION })}>
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 14 }}>{t('about_desc')}</div>
          <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
            <Link href="/privacidade" style={{ color: 'var(--pr)', fontWeight: 700, textDecoration: 'none' }}>
              {t('sec_privacy')}
            </Link>
            <Link href="/termos" style={{ color: 'var(--pr)', fontWeight: 700, textDecoration: 'none' }}>
              {t('sec_terms')}
            </Link>
          </div>
        </div>
      </Drawer>
    </>
  );
}
