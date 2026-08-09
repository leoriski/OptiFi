'use client';

// Atividade — paridade com o protótipo: banner "Extrato importado" + tabs
// Movimentos/Subscrições. Movimentos: manuais do mês corrente SEPARADOS do
// mês importado, pills de filtro por categoria, lista agrupada por dia.
// Subscrições: detetadas + adicionadas à mão, com a pergunta "usas?" — as
// sugestões resultantes aparecem na Análise (motor de insights).

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseCsv, decodeStatementText } from '@optifi/ingest';
import { prettyMerchant, type CategoryKey } from '@optifi/core';
import { useI18n, type DictKey } from '@/lib/i18n';
import { useFinance } from '@/lib/useFinance';
import { enterDemo, exitDemo } from '@/lib/demo';
import { fmtEur, monthLabel, fill } from '@/lib/format';
import { CategoryIcon, CATEGORY_COLOR } from '@/components/CategoryIcon';

type Bank = 'revolut' | 'cgd' | 'bcp' | 'outro';
type WizStep = null | 'bank' | 'guide' | 'busy' | 'map';

const BANKS: { id: Bank; name: string }[] = [
  { id: 'revolut', name: 'Revolut' },
  { id: 'cgd', name: 'CGD' },
  { id: 'bcp', name: 'Millennium BCP' },
  { id: 'outro', name: 'Outro banco / app' },
];

const GUIDES: Record<Bank, DictKey[]> = {
  revolut: ['wiz_guide_revolut_1', 'wiz_guide_revolut_2', 'wiz_guide_revolut_3'],
  cgd: ['wiz_guide_cgd_1', 'wiz_guide_cgd_2', 'wiz_guide_cgd_3'],
  bcp: ['wiz_guide_bcp_1', 'wiz_guide_bcp_2', 'wiz_guide_bcp_3'],
  outro: ['wiz_guide_outro_1', 'wiz_guide_outro_2', 'wiz_guide_outro_3'],
};

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--tx2)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'underline',
  fontFamily: 'Inter,sans-serif',
};

const FILTER_ORDER: CategoryKey[] =['habitacao', 'alimentacao', 'transporte', 'lazer', 'subscricoes', 'saude', 'educacao', 'transferencias', 'receita', 'outros'];
const MANUAL_CATS: CategoryKey[] = ['habitacao', 'alimentacao', 'transporte', 'lazer', 'subscricoes', 'saude', 'educacao', 'transferencias', 'outros'];

function CatChip({ category }: { category: string }) {
  const color = CATEGORY_COLOR[category] ?? CATEGORY_COLOR.outros!;
  return (
    <div className="tx-cat-icon" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
      <CategoryIcon category={category} color={color} size={15} />
    </div>
  );
}

export default function ActivityPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const fin = useFinance();
  const { loading, imported, imp, txs, subs, manual, planMonth } = fin;

  // Entra no modo demonstração (perfil Ana) e leva à Home populada.
  const startDemo = () => {
    enterDemo();
    router.push('/');
  };

  const [wiz, setWiz] = useState<WizStep>(null);
  const [bank, setBank] = useState<Bank>('revolut');
  const [error, setError] = useState<DictKey | ''>('');
  const [tab, setTab] = useState<'mov' | 'subs'>('mov');
  const [filter, setFilter] = useState<'all' | CategoryKey>('all');
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);

  // Mapeador universal
  const [mapRows, setMapRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState({ headerRow: 0, dateCol: 0, descriptionCol: 1, mode: 'signed' as 'signed' | 'split', amountCol: 2, debitCol: 2, creditCol: 3 });

  // Movimento manual
  const [showManualForm, setShowManualForm] = useState(false);
  const [mType, setMType] = useState<'expense' | 'income'>('expense');
  const [mAmount, setMAmount] = useState('');
  const [mCat, setMCat] = useState<CategoryKey>('outros');
  const [mNote, setMNote] = useState('');
  const [mMealCard, setMMealCard] = useState(false);

  // Subscrição manual
  const [showSubForm, setShowSubForm] = useState(false);
  const [sName, setSName] = useState('');
  const [sPrice, setSPrice] = useState('');

  // Re-análise dos extratos já importados com as regras atuais
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeMsg, setReanalyzeMsg] = useState('');

  async function reanalyze() {
    setReanalyzing(true);
    setReanalyzeMsg('');
    const res = await fetch('/api/reanalyze', { method: 'POST' });
    const body = (await res.json().catch(() => ({}))) as { changed?: number };
    if (!res.ok || body.changed === undefined) setReanalyzeMsg(t('act_reanalyze_error'));
    else if (body.changed === 0) setReanalyzeMsg(t('act_reanalyze_none'));
    else {
      setReanalyzeMsg(fill(t('act_reanalyze_done'), { n: body.changed }));
      await fin.reload();
    }
    setReanalyzing(false);
  }

  async function upload(file: File, withMapping?: typeof mapping) {
    setError('');
    setWiz('busy');
    const form = new FormData();
    form.append('file', file);
    if (bank !== 'outro') form.append('bank', bank);
    if (withMapping) {
      const m: Record<string, number> = { headerRow: withMapping.headerRow, dateCol: withMapping.dateCol, descriptionCol: withMapping.descriptionCol };
      if (withMapping.mode === 'signed') m.amountCol = withMapping.amountCol;
      else {
        m.debitCol = withMapping.debitCol;
        m.creditCol = withMapping.creditCol;
      }
      form.append('mapping', JSON.stringify(m));
    }
    const res = await fetch('/api/import', { method: 'POST', body: form });
    if (res.ok) {
      pendingFile.current = null;
      setWiz(null);
      exitDemo(); // uma importação REAL desliga o modo demonstração
      await fin.reload();
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === 'unknown_format' && !withMapping) {
      pendingFile.current = file;
      const bytes = new Uint8Array(await file.arrayBuffer());
      setMapRows(parseCsv(decodeStatementText(bytes)).slice(0, 8));
      setError('wiz_err_unknown_format');
      setWiz('map');
      return;
    }
    setError(body.error === 'file_size' ? 'wiz_err_file_size' : body.error === 'no_valid_rows' ? 'wiz_err_no_valid_rows' : body.error === 'pdf_unreadable' ? 'wiz_err_pdf' : 'wiz_err_generic');
    setWiz('guide');
  }

  async function addManualEntry() {
    const amount = parseFloat(mAmount.replace(',', '.'));
    if (!(amount > 0)) return;
    await fin.addManual({ type: mType, amount, category: mType === 'income' ? 'receita' : mCat, note: mNote, mealCard: mType === 'expense' && mMealCard });
    setMAmount('');
    setMNote('');
    setMMealCard(false);
    setShowManualForm(false);
  }

  async function addSub() {
    const price = parseFloat(sPrice.replace(',', '.'));
    if (!sName.trim() || !(price > 0)) return;
    await fin.addSubscription(sName, price);
    setSName('');
    setSPrice('');
    setShowSubForm(false);
  }

  if (loading) return <div className="card" style={{ color: 'var(--tx2)', fontSize: 13 }}>…</div>;

  const header = (
    <>
      <div className="ptitle">{t('nav_activity')}</div>
      <div className="psub">{t('act_page_sub')}</div>
    </>
  );
  // Primeiro arranque (ainda sem importação): cabeçalho de boas-vindas em vez
  // do genérico "Atividade" — para quem chega, isto é a configuração inicial.
  const firstRun = !imported;
  const welcomeHeader = (
    <>
      <div className="ptitle">{t('onb_welcome_title')}</div>
      <div className="psub">{t('onb_welcome_sub')}</div>
    </>
  );

  const wizardActive = wiz !== null || !imported;
  const step: WizStep = wizardActive ? (wiz ?? 'bank') : null;

  // ── Wizard (importação) ──
  if (step) {
    return (
      <>
        {firstRun ? welcomeHeader : header}
        {step === 'bank' && (
          <div className="card">
            <div className="wiz-s-title">{t('wiz_title')}</div>
            <div className="wiz-s-sub">{t('wiz_sub')}</div>
            <div className="wiz-bank-grid">
              {BANKS.map((b) => (
                <button
                  key={b.id}
                  className="wiz-bank-item"
                  onClick={() => {
                    setBank(b.id);
                    setError('');
                    setWiz('guide');
                  }}
                >
                  <div className="wiz-bank-emoji">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--pr)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
                    </svg>
                  </div>
                  <div className="wiz-bank-name">{b.name}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 12 }}>{t('wiz_privacy')}</div>
            {!imported && (
              <>
                <div className="wiz-demo-sep"><span>{t('wiz_demo_or')}</span></div>
                <button className="wiz-demo-btn" onClick={startDemo}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  <span>{t('wiz_demo_cta')}</span>
                </button>
                <div className="wiz-demo-hint">{t('wiz_demo_hint')}</div>
              </>
            )}
            {imported && (
              <button className="wiz-back" style={{ marginTop: 12 }} onClick={() => setWiz(null)}>
                {t('wiz_back')}
              </button>
            )}
          </div>
        )}
        {step === 'guide' && (
          <div className="card">
            <div className="wiz-s-title">{BANKS.find((b) => b.id === bank)?.name}</div>
            <div className="wiz-guide-steps">
              {GUIDES[bank].map((k, i) => (
                <div key={k} className="wiz-guide-step">
                  <div className="wiz-guide-step-num">{i + 1}</div>
                  <div className="wiz-guide-step-txt">{t(k)}</div>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.pdf,text/csv,text/plain,application/pdf" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            <div
              className="wiz-upload-zone"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) void upload(e.dataTransfer.files[0]);
              }}
            >
              <div className="wiz-upload-icon">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="var(--pr)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m17 8-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
              </div>
              <div className="wiz-upload-title">{t('wiz_drop')}</div>
              <div className="wiz-upload-types">
                <span className="wiz-upload-type-badge">CSV</span>
                <span className="wiz-upload-type-badge">PDF</span>
              </div>
            </div>
            <div className="wiz-privacy-strong">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
              <span>{t('wiz_privacy_strong')}</span>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--re)' }}>{t(error)}</div>}
            <button className="wiz-back" style={{ marginTop: 14 }} onClick={() => setWiz('bank')}>
              {t('wiz_back')}
            </button>
          </div>
        )}
        {step === 'busy' && (
          <div className="card" style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--tx2)' }}>{t('wiz_processing')}</div>
        )}
        {step === 'map' && (
          <div className="card">
            <div className="wiz-s-title">{t('wiz_map_title')}</div>
            <div className="wiz-s-sub">{t('wiz_map_sub')}</div>
            <div style={{ overflowX: 'auto', marginBottom: 14, border: '1px solid var(--b)', borderRadius: 'var(--rs)' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
                <tbody>
                  {mapRows.map((r, i) => (
                    <tr key={i} style={{ background: i === mapping.headerRow ? 'color-mix(in srgb, var(--pr) 12%, transparent)' : 'transparent' }}>
                      <td style={{ padding: '4px 6px', color: 'var(--tx3)', borderBottom: '1px solid var(--b)' }}>{i + 1}</td>
                      {r.map((c, j) => (
                        <td key={j} style={{ padding: '4px 8px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--b)', color: 'var(--tx2)' }}>
                          {c.slice(0, 24)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <label style={{ color: 'var(--tx2)', fontWeight: 700 }}>
                {t('map_header_row')}
                <select className="auth-input" style={{ padding: '9px 10px', marginTop: 4 }} value={mapping.headerRow} onChange={(e) => setMapping({ ...mapping, headerRow: Number(e.target.value) })}>
                  {mapRows.map((_, i) => (
                    <option key={i} value={i}>{i + 1}</option>
                  ))}
                </select>
              </label>
              <label style={{ color: 'var(--tx2)', fontWeight: 700 }}>
                {t('map_date')}
                <select className="auth-input" style={{ padding: '9px 10px', marginTop: 4 }} value={mapping.dateCol} onChange={(e) => setMapping({ ...mapping, dateCol: Number(e.target.value) })}>
                  {(mapRows[mapping.headerRow] ?? []).map((c, i) => (
                    <option key={i} value={i}>{i + 1} — {c.slice(0, 24) || '(vazio)'}</option>
                  ))}
                </select>
              </label>
              <label style={{ color: 'var(--tx2)', fontWeight: 700 }}>
                {t('map_desc')}
                <select className="auth-input" style={{ padding: '9px 10px', marginTop: 4 }} value={mapping.descriptionCol} onChange={(e) => setMapping({ ...mapping, descriptionCol: Number(e.target.value) })}>
                  {(mapRows[mapping.headerRow] ?? []).map((c, i) => (
                    <option key={i} value={i}>{i + 1} — {c.slice(0, 24) || '(vazio)'}</option>
                  ))}
                </select>
              </label>
              <label style={{ color: 'var(--tx2)', fontWeight: 700 }}>
                &nbsp;
                <select className="auth-input" style={{ padding: '9px 10px', marginTop: 4 }} value={mapping.mode} onChange={(e) => setMapping({ ...mapping, mode: e.target.value as 'signed' | 'split' })}>
                  <option value="signed">{t('map_mode_signed')}</option>
                  <option value="split">{t('map_mode_split')}</option>
                </select>
              </label>
              {mapping.mode === 'signed' ? (
                <label style={{ color: 'var(--tx2)', fontWeight: 700 }}>
                  {t('map_amount')}
                  <select className="auth-input" style={{ padding: '9px 10px', marginTop: 4 }} value={mapping.amountCol} onChange={(e) => setMapping({ ...mapping, amountCol: Number(e.target.value) })}>
                    {(mapRows[mapping.headerRow] ?? []).map((c, i) => (
                      <option key={i} value={i}>{i + 1} — {c.slice(0, 24) || '(vazio)'}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label style={{ color: 'var(--tx2)', fontWeight: 700 }}>
                    {t('map_debit')}
                    <select className="auth-input" style={{ padding: '9px 10px', marginTop: 4 }} value={mapping.debitCol} onChange={(e) => setMapping({ ...mapping, debitCol: Number(e.target.value) })}>
                      {(mapRows[mapping.headerRow] ?? []).map((c, i) => (
                        <option key={i} value={i}>{i + 1} — {c.slice(0, 24) || '(vazio)'}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ color: 'var(--tx2)', fontWeight: 700 }}>
                    {t('map_credit')}
                    <select className="auth-input" style={{ padding: '9px 10px', marginTop: 4 }} value={mapping.creditCol} onChange={(e) => setMapping({ ...mapping, creditCol: Number(e.target.value) })}>
                      {(mapRows[mapping.headerRow] ?? []).map((c, i) => (
                        <option key={i} value={i}>{i + 1} — {c.slice(0, 24) || '(vazio)'}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => pendingFile.current && void upload(pendingFile.current, mapping)}>
              {t('map_apply')}
            </button>
            <button className="wiz-back" style={{ marginTop: 8 }} onClick={() => setWiz('bank')}>
              {t('wiz_back')}
            </button>
          </div>
        )}
      </>
    );
  }

  // ── Vista normal: banner + tabs ──
  const pastMonth = imp ? monthLabel(imp.statement_month, lang) : '';
  const currMonth = monthLabel(planMonth, lang);
  const presentCats = FILTER_ORDER.filter((c) => txs.some((tx) => tx.category === c));
  const filteredTxs = filter === 'all' ? txs : txs.filter((tx) => tx.category === filter);
  const activeSubs = subs.filter((s) => s.user_status !== 'cancelled');
  const subsTotal = activeSubs.reduce((a, b) => a + Number(b.price), 0);

  const tabPill = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: 11,
    borderRadius: 'var(--rs)',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'Inter,sans-serif',
    background: active ? 'var(--pr)' : 'transparent',
    color: active ? 'var(--bg)' : 'var(--tx2)',
    border: 'none',
  });

  const verdictBtn = (label: string, color: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        padding: '7px 11px',
        borderRadius: 'var(--rs)',
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        background: 'var(--card2)',
        color,
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
        fontFamily: 'Inter,sans-serif',
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      {header}

      {/* Banner: extrato importado + re-analisar + re-importar */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '13px 15px',
          background: 'var(--card)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx2)' }}>{t('act_imported_banner')}</span>
        <div style={{ display: 'flex', gap: 14 }}>
          <button onClick={() => void reanalyze()} disabled={reanalyzing} style={linkBtn}>
            {reanalyzing ? t('act_reanalyze_busy') : t('act_reanalyze_link')}
          </button>
          <button onClick={() => setWiz('bank')} style={linkBtn}>
            {t('act_reimport_link')}
          </button>
        </div>
        {reanalyzeMsg && (
          <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--tx2)' }}>{reanalyzeMsg}</div>
        )}
      </div>

      {/* Tabs Movimentos | Subscrições */}
      <div className="card" style={{ display: 'flex', gap: 4, padding: 5 }}>
        <button style={tabPill(tab === 'mov')} onClick={() => setTab('mov')}>
          {t('act_tab_movements')}
        </button>
        <button style={tabPill(tab === 'subs')} onClick={() => setTab('subs')}>
          {t('act_tab_subs')}
        </button>
      </div>

      {tab === 'mov' ? (
        <>
          {/* Adicionar movimento manual */}
          {showManualForm ? (
            <div className="card">
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(['expense', 'income'] as const).map((ty) => (
                  <button
                    key={ty}
                    onClick={() => setMType(ty)}
                    style={{
                      flex: 1,
                      padding: 9,
                      borderRadius: 'var(--rs)',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: 'Inter,sans-serif',
                      background: mType === ty ? 'var(--pr)' : 'var(--card2)',
                      color: mType === ty ? 'var(--bg)' : 'var(--tx2)',
                      border: mType === ty ? '1px solid transparent' : '1px solid var(--b)',
                    }}
                  >
                    {ty === 'expense' ? t('manual_type_expense') : t('manual_type_income')}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="auth-input" type="number" inputMode="decimal" placeholder={t('manual_amount')} value={mAmount} onChange={(e) => setMAmount(e.target.value)} />
                {mType === 'expense' ? (
                  <select className="auth-input" value={mCat} onChange={(e) => setMCat(e.target.value as CategoryKey)}>
                    {MANUAL_CATS.map((c) => (
                      <option key={c} value={c}>{t(`cat_${c}` as DictKey)}</option>
                    ))}
                  </select>
                ) : (
                  <div />
                )}
              </div>
              <input className="auth-input" placeholder={t('manual_note')} value={mNote} onChange={(e) => setMNote(e.target.value)} style={{ marginBottom: 10 }} />
              {mType === 'expense' && fin.mealCard > 0 && (
                <button
                  onClick={() => setMMealCard(!mMealCard)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    padding: '10px 12px',
                    marginBottom: 10,
                    borderRadius: 'var(--rs)',
                    border: mMealCard ? '1px solid var(--tx)' : '1px solid var(--b)',
                    background: 'var(--card2)',
                    cursor: 'pointer',
                    fontFamily: 'Inter,sans-serif',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: mMealCard ? 'none' : '1.5px solid var(--tx3)',
                      background: mMealCard ? 'var(--tx)' : 'transparent',
                      color: 'var(--bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {mMealCard ? '✓' : ''}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>{t('manual_meal_toggle')}</span>
                </button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1, padding: 11, fontSize: 12 }} onClick={() => void addManualEntry()}>
                  {t('manual_save')}
                </button>
                <button className="btn-secondary" style={{ flex: 1, padding: 11, fontSize: 12 }} onClick={() => setShowManualForm(false)}>
                  {t('goal_cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowManualForm(true)}
              style={{
                width: '100%',
                padding: 14,
                marginBottom: 11,
                background: 'transparent',
                border: '1px dashed color-mix(in srgb, var(--pr) 45%, transparent)',
                borderRadius: 'var(--r)',
                color: 'var(--pr)',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'Inter,sans-serif',
              }}
            >
              {t('act_add_manual')}
            </button>
          )}

          {/* Mês corrente (manual) — nunca misturado com o importado.
              O saldo de abertura (âncora) aparece aqui como ponto de partida. */}
          {(manual.length > 0 || fin.openingBalance) && (
            <>
              <div className="sec">{fill(t('act_sec_manual'), { month: currMonth })}</div>
              <div className="card">
                {fin.openingBalance && (
                  <div className="tx-item" style={{ background: 'color-mix(in srgb, var(--gr) 7%, transparent)', borderRadius: 'var(--rs)', padding: '10px 10px', marginBottom: 2 }}>
                    <div className="tx-cat-icon" style={{ background: 'color-mix(in srgb, var(--gr) 16%, transparent)' }}>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--gr)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12l7-7 7 7" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tx-name">{t('bal_opening')}</div>
                      <div className="tx-cat">
                        {fill(t('bal_opening_sub'), {
                          date: new Date(fin.openingBalance.at).toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', { day: 'numeric', month: 'short' }),
                        })}
                      </div>
                    </div>
                    <div className="tx-amt tx-amt-pos">+{fmtEur(fin.openingBalance.amount)}</div>
                    <button
                      onClick={() => void fin.clearBalance()}
                      aria-label={t('manual_delete')}
                      style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 15, padding: 4 }}
                    >
                      ×
                    </button>
                  </div>
                )}
                {manual.map((m) => (
                  <div key={m.id} className="tx-item">
                    <CatChip category={m.category} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tx-name">{m.note || t(`cat_${m.category}` as DictKey)}</div>
                      <div className="tx-cat">
                        {t(`cat_${m.category}` as DictKey)}
                        {m.meal_card && <span style={{ color: 'var(--tx3)' }}> · {t('meal_card_title')}</span>}
                      </div>
                    </div>
                    <div className={`tx-amt${m.entry_type === 'income' ? ' tx-amt-pos' : ''}`}>
                      {m.entry_type === 'income' ? '+' : '−'}
                      {fmtEur(Number(m.amount))}
                    </div>
                    <button
                      onClick={() => void fin.removeManual(m.id)}
                      aria-label={t('manual_delete')}
                      style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 15, padding: 4 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Mês importado */}
          <div className="sec">{fill(t('act_sec_imported'), { month: pastMonth })}</div>
          <div className="cat-pills">
            <button className={`cat-pill${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>
              {t('act_filter_all')}
            </button>
            {presentCats.map((c) => (
              <button key={c} className={`cat-pill${filter === c ? ' on' : ''}`} onClick={() => setFilter(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CategoryIcon category={c} size={12} color={filter === c ? 'var(--bg)' : 'var(--tx2)'} />
                {t(`cat_${c}` as DictKey)}
              </button>
            ))}
          </div>
          <div className="card">
            {filteredTxs.map((tx, i) => {
              const showDate = i === 0 || filteredTxs[i - 1]!.tx_date !== tx.tx_date;
              return (
                <div key={`${tx.tx_date}-${i}`}>
                  {showDate && (
                    <div className="tx-date-hdr">
                      {new Date(tx.tx_date + 'T00:00:00').toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase()}
                    </div>
                  )}
                  <div className="tx-item">
                    <CatChip category={tx.category} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tx-name">{prettyMerchant(tx.description)}</div>
                      <div className="tx-cat">{t(`cat_${tx.category}` as DictKey)}</div>
                    </div>
                    <div className={`tx-amt${tx.tx_type === 'income' ? ' tx-amt-pos' : ' tx-amt-neg'}`}>
                      {tx.tx_type === 'income' ? '+' : '−'}
                      {fmtEur(Number(tx.amount))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Subscrições: detetadas + manuais, com a pergunta "usas?" */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 15px' }}>
            <span style={{ fontSize: 12, color: 'var(--tx2)' }}>
              {fill(t('subs_active_total'), { n: activeSubs.length, amount: `−${fmtEur(subsTotal)}` })}
            </span>
          </div>
          {subs.map((s) => {
            const statusKey: Record<string, DictKey> = { confirmed: 'subs_state_confirmed', rejected: 'subs_state_rejected', cancelled: 'subs_state_cancelled' };
            const statusColor: Record<string, string> = { confirmed: 'var(--tx2)', rejected: 'var(--tx2)', cancelled: 'var(--tx2)' };
            const isManual = s.import_id === null || s.import_id === undefined;
            return (
              <div key={s.id} className="card">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: s.user_status === 'unknown' ? 10 : 8 }}>
                  <CatChip category="subscricoes" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tx-name" style={{ textDecoration: s.user_status === 'cancelled' ? 'line-through' : 'none' }}>{prettyMerchant(s.name)}</div>
                    <div className="tx-cat">
                      {isManual ? t('subs_manual_tag') : t('cat_subscricoes')}
                      {s.user_status !== 'unknown' && (
                        <span style={{ marginLeft: 7, fontWeight: 800, color: statusColor[s.user_status] }}>{t(statusKey[s.user_status]!)}</span>
                      )}
                    </div>
                  </div>
                  <div className="tx-amt">−{fmtEur(Number(s.price))}/mês</div>
                  {isManual && (
                    <button
                      onClick={() => void fin.removeSubscription(s.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 15, padding: 4 }}
                    >
                      ×
                    </button>
                  )}
                </div>
                {s.user_status === 'unknown' ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx2)', marginBottom: 7 }}>{t('subs_q')}</div>
                    <div style={{ display: 'flex', gap: 7 }}>
                      {verdictBtn(t('subs_confirm'), 'var(--tx)', () => void fin.setSubVerdict(s.id, 'confirmed'))}
                      {verdictBtn(t('subs_reject'), 'var(--tx2)', () => void fin.setSubVerdict(s.id, 'rejected'))}
                      {verdictBtn(t('subs_cancel'), 'var(--re)', () => void fin.setSubVerdict(s.id, 'cancelled'))}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 7 }}>{verdictBtn(t('subs_restore'), 'var(--tx2)', () => void fin.setSubVerdict(s.id, 'unknown'))}</div>
                )}
              </div>
            );
          })}

          {/* Adicionar subscrição manual */}
          {showSubForm ? (
            <div className="card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <input className="auth-input" placeholder={t('subs_add_name')} value={sName} onChange={(e) => setSName(e.target.value)} />
                <input className="auth-input" type="number" inputMode="decimal" placeholder={t('subs_add_price')} value={sPrice} onChange={(e) => setSPrice(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1, padding: 11, fontSize: 12 }} onClick={() => void addSub()}>
                  {t('manual_save')}
                </button>
                <button className="btn-secondary" style={{ flex: 1, padding: 11, fontSize: 12 }} onClick={() => setShowSubForm(false)}>
                  {t('goal_cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSubForm(true)}
              style={{
                width: '100%',
                padding: 14,
                background: 'transparent',
                border: '1px dashed color-mix(in srgb, var(--pr) 45%, transparent)',
                borderRadius: 'var(--r)',
                color: 'var(--pr)',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'Inter,sans-serif',
              }}
            >
              {t('subs_add')}
            </button>
          )}
        </>
      )}
    </>
  );
}
