'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useI18n, type DictKey } from '@/lib/i18n';
import { useFinance } from '@/lib/useFinance';
import { fmtEur, fmtEur0, fill, monthLabel } from '@optifi/core';
import { EmptyImportState } from '@/components/EmptyImportState';
import { insightText, insightTitle, orderInsights, type Insight } from '@optifi/core';

// Limpeza à Revolut: cor SÓ na semântica de dinheiro — fuga (perda) vermelha,
// poupança (ganho) verde. Alertas e conquistas são neutros.
const KIND_STYLE: Record<string, { bg: string; labelKey: DictKey }> = {
  leak: { bg: 'var(--card2)', labelKey: 'ins_cat_leak' },
  alert: { bg: 'var(--card2)', labelKey: 'ins_cat_alert' },
  savings: { bg: 'var(--card2)', labelKey: 'ins_cat_savings' },
  achievement: { bg: 'var(--card2)', labelKey: 'ins_cat_ach' },
};

const KIND_ICON: Record<string, React.ReactNode> = {
  leak: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v14M6 11l6 6 6-6" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
    </svg>
  ),
  savings: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M15.5 13.5 12 17l-3.5-3.5" transform="rotate(180 12 12)" />
    </svg>
  ),
  achievement: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M6 3h12v6a6 6 0 0 1-12 0V3Z" />
      <path d="M6 5H3v2a4 4 0 0 0 3 3.87M18 5h3v2a4 4 0 0 1-3 3.87" />
    </svg>
  ),
};

// Categorias que o utilizador pode limitar (todas as de despesa). A lista de
// escolha vive oculta atrás de um toque — o utilizador decide o que controlar,
// incluindo Casa/habitação mesmo que só a lance à mão.
const LIMITABLE_CATS = ['habitacao', 'alimentacao', 'transporte', 'saude', 'educacao', 'lazer', 'subscricoes', 'transferencias', 'outros'];

function LimitRow({
  categoryId,
  spent,
  lastMonth,
  limit,
  state,
  onSet,
  onClear,
  t,
}: {
  categoryId: string;
  /** Gasto do MÊS CORRENTE (o que o utilizador registou). */
  spent: number;
  /** Referência: o que gastou no mês analisado. */
  lastMonth: number;
  limit: number | undefined;
  state: { state: string; overBy: number } | undefined;
  onSet: (eur: number) => void;
  onClear: () => void;
  t: (k: DictKey) => string;
}) {
  const [val, setVal] = useState(limit !== undefined ? String(limit) : '');
  const stateChip = state
    ? state.state === 'ok'
      ? { txt: t('limits_state_ok'), color: 'var(--tx2)' }
      : state.state === 'tight'
        ? { txt: t('limits_state_tight'), color: 'var(--tx2)' }
        : { txt: fill(t('limits_state_over'), { amount: fmtEur(state.overBy) }), color: 'var(--tx)' }
    : null;
  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid var(--b)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ fontWeight: 800 }}>
          {t(`cat_${categoryId}` as DictKey)}
          {stateChip && (
            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: stateChip.color }}>{stateChip.txt}</span>
          )}
        </span>
        <span style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', color: 'var(--tx2)', fontSize: 11, fontWeight: 700 }}>{fill(t('limits_spent'), { amount: fmtEur(spent) })}</span>
          <span style={{ display: 'block', color: 'var(--tx3)', fontSize: 10 }}>{fill(t('limits_ref'), { amount: fmtEur(lastMonth) })}</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="auth-input"
          style={{ padding: '8px 10px', fontSize: 12, width: 110 }}
          type="number"
          inputMode="decimal"
          placeholder={t('limits_placeholder')}
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button
          style={{ padding: '7px 12px', borderRadius: 'var(--rs)', border: '1px solid var(--b)', background: 'var(--card2)', color: 'var(--pr)', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => {
            const v = parseFloat(val.replace(',', '.'));
            if (v >= 0) onSet(v);
          }}
        >
          {t('limits_set')}
        </button>
        {limit !== undefined && (
          <button
            style={{ padding: '7px 12px', borderRadius: 'var(--rs)', border: '1px solid var(--b)', background: 'var(--card2)', color: 'var(--tx3)', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => {
              setVal('');
              onClear();
            }}
          >
            {t('limits_clear')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { t, lang } = useI18n();
  const { loading, imported, imp, fs, analysis, smart, subs, categorySpend, limits, planMonth, setLimit, clearLimit } = useFinance();
  const [showAllInsights, setShowAllInsights] = useState(false);

  if (loading) return <div className="card" style={{ color: 'var(--tx2)', fontSize: 13 }}>…</div>;
  if (!imported || !fs || !analysis) {
    return (
      <>
        <div className="ptitle" style={{ marginBottom: 14 }}>{t('nav_insights')}</div>
        <EmptyImportState msgKey="empty_insights" />
      </>
    );
  }

  const catLabel = (id: string) => t(`cat_${id}` as DictKey);
  /** O mês a que os números da análise pertencem — o do extrato, não o de hoje. */
  const statementMonth = imp ? monthLabel(imp.statement_month, lang) : '';

  const ordered = orderInsights(smart, analysis.insights);
  const PRIMARY_INSIGHTS = 5;
  const deps = { t, catLabel, fmtEur, fmtEur0, fill, statementMonth };
  const visibleInsights = showAllInsights ? ordered : ordered.slice(0, PRIMARY_INSIGHTS);
  const hiddenCount = ordered.length - visibleInsights.length;

  return (
    <>
      <div className="ptitle" style={{ marginBottom: 14 }}>{t('nav_insights')}</div>

      {/* Subscrições — resumo */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 2 }}>{t('subs_title')}</div>
            <div style={{ fontSize: 12, color: 'var(--tx2)' }}>
              {fill(t('subs_active_total'), {
                n: subs.filter((s) => s.user_status !== 'cancelled').length,
                amount: fmtEur(fs.subsTotal),
              })}
            </div>
          </div>
          <Link href="/atividade" style={{ fontSize: 12, fontWeight: 800, color: 'var(--pr)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {t('subs_review_cta')} →
          </Link>
        </div>
      </div>

      {/* Limites por categoria */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>{t('limits_title')}</div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
          {fill(t('limits_sub'), { month: monthLabel(planMonth, lang) })}
        </div>
        {fs.limitsSavingsPotential > 0 && (
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx)', marginBottom: 4 }}>
            {fill(t('limits_potential'), { amount: fmtEur(fs.limitsSavingsPotential) })}
          </div>
        )}
        <details className="limits-collapse">
          <summary>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            <span>{t('limits_toggle')}</span>
            <svg className="chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <div className="limits-collapse-body">
            {LIMITABLE_CATS.map((cat) => (
              <LimitRow
                key={cat}
                categoryId={cat}
                spent={fs.manualCategorySpend.find((m) => m.categoryId === cat)?.amount ?? 0}
                lastMonth={categorySpend.find((c) => c.categoryId === cat)?.amount ?? 0}
                limit={limits[cat]}
                state={fs.categoryLimitStates[cat]}
                onSet={(eur) => void setLimit(cat, eur)}
                onClear={() => void clearLimit(cat)}
                t={t}
              />
            ))}
          </div>
        </details>
      </div>

      {/* Insights: inteligentes (motor) + informativos da análise base */}
      {visibleInsights.map((ins) => {
        const style = KIND_STYLE[ins.kind]!;
        const isSubPrice = ins.id.startsWith('sub_save_') || ins.id.startsWith('sub_free_');
        return (
          <div key={ins.id} className="card" style={{ marginBottom: 10 }}>
            <div className="ins-header">
              <div className="ins-icon-wrap" style={{ background: style.bg }}>{KIND_ICON[ins.kind]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span className="ins-title" style={{ marginBottom: 0 }}>{insightTitle(ins, { t, catLabel })}</span>
                  {ins.saving > 0 && <span className="ins-saving-badge" style={{ marginBottom: 0, flexShrink: 0 }}>+{fmtEur(ins.saving)}/mês</span>}
                </div>
                <div className="ins-desc" style={{ marginTop: 4 }}>{insightText(ins, deps)}</div>
                {ins.params.fv10 !== undefined && (
                  <details className="invest-more">
                    <summary>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M3 17 9 11l4 4 8-8" />
                        <path d="M14 7h7v7" />
                      </svg>
                      <span>{t('ins_invest_toggle')}</span>
                      <svg className="chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <div className="invest-more-body">
                      {fill(t('ins_invest_multi'), {
                        monthly: fmtEur(Number(ins.params.monthly)),
                        rate: ins.params.rate!,
                        fv10: fmtEur0(Number(ins.params.fv10)),
                        fv15: fmtEur0(Number(ins.params.fv15)),
                        fv20: fmtEur0(Number(ins.params.fv20)),
                      })}
                    </div>
                  </details>
                )}
                {isSubPrice && <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 6 }}>{t('ins_prices_note')}</div>}
              </div>
            </div>
          </div>
        );
      })}
      {(hiddenCount > 0 || showAllInsights) && ordered.length > PRIMARY_INSIGHTS && (
        <button className="see-more-btn" onClick={() => setShowAllInsights((v) => !v)}>
          <span>{showAllInsights ? t('ins_see_less') : fill(t('ins_see_more'), { n: hiddenCount })}</span>
          <svg className="chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showAllInsights ? 'rotate(180deg)' : 'none' }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
      {smart.length === 0 && analysis.insights.length === 0 && (
        <div className="card" style={{ fontSize: 12, color: 'var(--tx2)' }}>{fill(t('ins_empty'), { month: statementMonth })}</div>
      )}
    </>
  );
}
