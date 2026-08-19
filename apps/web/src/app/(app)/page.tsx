'use client';

// Home — paridade com o protótipo: saudação → dica do dia → Money Leak →
// CASHFLOW (balcard + gráfico) → Quanto podes gastar (métodos A/B, cenários,
// margem, "como calculámos") → Próxima meta. O plano de poupança abre em
// drawer (bottom sheet), como no original.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { daysLeftInMonth, importCadence } from '@optifi/core';
import { useI18n, type DictKey } from '@/lib/i18n';
import { useFinance } from '@/lib/useFinance';
import { fmtEur, fmtEur0, monthLabel, monthShort, fill } from '@/lib/format';
import { EmptyImportState } from '@/components/EmptyImportState';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CashflowChart, type CashflowPoint } from '@/components/CashflowChart';
import { PlanDrawer } from '@/components/PlanDrawer';

// Ícone automático da meta a partir do nome (o picker visual vem depois).
function GoalIcon({ name, size = 22 }: { name: string; size?: number }) {
  const n = name.toLowerCase();
  const stroke = { fill: 'none', stroke: 'var(--pr)', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (/viagem|viaje|trip|férias|ferias|japão|japao|travel/.test(n)) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
      </svg>
    );
  }
  if (/casa|house|entrada|apartamento/.test(n)) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
        <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
        <path d="M9 21v-6h6v6" />
      </svg>
    );
  }
  if (/carro|car|moto/.test(n)) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
        <path d="M5 17H3V7a1 1 0 0 1 1-1h10l4 5h2a1 1 0 0 1 1 1v5h-2" />
        <circle cx="7.5" cy="17.5" r="1.8" />
        <circle cx="16.5" cy="17.5" r="1.8" />
      </svg>
    );
  }
  if (/emerg|fundo|reserva|segurança|seguranca/.test(n)) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export default function HomePage() {
  const { t, lang } = useI18n();
  const fin = useFinance();
  const { loading, imported, imp, fs, analysis, goals, planState, profileName, history, manual, planMonth, balanceSet } = fin;
  const [planOpen, setPlanOpen] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [editingBalance, setEditingBalance] = useState(false);
  const [mealInput, setMealInput] = useState('');
  const [editingMeal, setEditingMeal] = useState(false);

  const hour = new Date().getHours();
  const greetKey: DictKey = hour < 12 ? 'greeting_morning' : hour < 20 ? 'greeting_afternoon' : 'greeting_evening';
  const currMonth = monthLabel(planMonth, lang);

  const chartLabels = useMemo(() => ({ net: t('chart_net'), income: t('chart_income'), expenses: t('chart_expenses') }), [t]);
  const chartPoints: CashflowPoint[] = useMemo(() => {
    const pts: CashflowPoint[] = history.map((h) => ({
      label: monthShort(h.statement_month, lang),
      income: Number(h.income),
      expenses: Number(h.expenses),
    }));
    if (fs && (fs.manualIncomeThisMonth > 0 || fs.manualExpensesThisMonth > 0)) {
      pts.push({ label: monthShort(planMonth, lang), income: fs.manualIncomeThisMonth, expenses: fs.manualExpensesThisMonth });
    }
    return pts;
  }, [history, fs, planMonth, lang]);

  if (loading) return <div className="card" style={{ color: 'var(--tx2)', fontSize: 13 }}>…</div>;

  // Retenção: streak de meses seguidos analisados + falta o último mês fechado.
  const cadence = importCadence(history.map((h) => h.statement_month), new Date());

  const greeting = (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div className="ptitle">
          {t(greetKey)}
          {profileName ? `, ${profileName.split(' ')[0]}` : ''}
        </div>
        {cadence.streak >= 2 && (
          <div className="streak-pill" title={t('streak_tip')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none"><path d="M12 2c1 3-1 4-2 6-1 2 0 4 2 4 1.5 0 2.5-1 2.5-2 1.5 1.5 2.5 3.5 2.5 5.5A7 7 0 0 1 5 15c0-3 2-5 3-7 1.3-1.6 3.2-3 4-6Z" /></svg>
            <span>{fill(t('streak_badge'), { n: cadence.streak })}</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 1 }}>{fill(t('home_sub'), { month: currMonth })}</div>
    </div>
  );

  if (!imported || !fs || !imp || !analysis) {
    return (
      <>
        {greeting}
        <EmptyImportState msgKey="empty_home" />
      </>
    );
  }

  const pastMonth = monthLabel(imp.statement_month, lang);
  const activeItems = analysis.planItems.filter((p) => {
    const st = planState[p.id]?.state;
    return st !== 'done' && st !== 'ignored';
  });
  const topItems = activeItems.slice(0, 3);
  const moreAmount = activeItems.slice(3).reduce((a, b) => a + b.monthlySaving, 0);

  // ── Quanto podes gastar — UM só modelo, ligado ao saldo real ──
  // spendableNow = saldo atual (âncora + movimentos registados depois) menos
  // o que está reservado para metas. Tudo derivado do motor, nada inventado.
  const days = daysLeftInMonth(new Date());
  const optSavings = fs.leakTotal + fs.limitsSavingsPotential;
  const spendable = fs.spendableNow ?? 0;
  // O ritmo semanal nunca é negativo (não podes gastar menos que nada); o
  // detalhe abaixo mostra o gastável real, com sinal, quando negativo.
  const nowW = (Math.max(0, spendable) / days) * 7;
  // Cortar não te deixa gastar MAIS — deixa-te ficar com mais no fim do mês.
  // A versão anterior somava a poupança ao gastável e anunciava um ritmo
  // semanal maior, ou seja: um cartão chamado "quanto podes gastar" que subia
  // quando poupavas. O que o plano vale nos dias que faltam é a poupança
  // mensal proporcional a esses dias.
  const monthDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const planKeep = optSavings * (days / monthDays);

  const saveBalance = async () => {
    const v = parseFloat(balanceInput.replace(',', '.'));
    if (Number.isNaN(v)) return;
    await fin.setBalance(v);
    setEditingBalance(false);
    setBalanceInput('');
  };

  const saveMeal = async () => {
    const v = parseFloat(mealInput.replace(',', '.'));
    if (Number.isNaN(v) || v < 0) return;
    await fin.setMealCardValue(v);
    setEditingMeal(false);
    setMealInput('');
  };

  const clearMeal = async () => {
    await fin.setMealCardValue(0);
    setEditingMeal(false);
    setMealInput('');
  };

  // Próxima meta (prazo mais próximo, por atingir)
  const nextGoal = [...goals]
    .filter((g) => Number(g.current_eur) < Number(g.target_eur))
    .sort((a, b) => (a.target_year ?? 9999) * 100 + (a.target_month ?? 12) - ((b.target_year ?? 9999) * 100 + (b.target_month ?? 12)))[0];
  const goalPct = nextGoal ? Math.min(100, Math.round((Number(nextGoal.current_eur) / Number(nextGoal.target_eur)) * 100)) : 0;
  const goalDate = nextGoal?.target_month && nextGoal.target_year
    ? new Date(nextGoal.target_year, nextGoal.target_month - 1, 1).toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', { month: 'short', year: 'numeric' })
    : '';

  const scenarioBox = (kind: 'now' | 'plan') => (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        marginTop: kind === 'now' ? 13 : 8,
        padding: '10px 12px',
        borderRadius: 'var(--rs)',
        background: 'var(--card2)',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--tx3)', flexShrink: 0, marginTop: 4 }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--tx)', marginBottom: 2 }}>
          {t(kind === 'now' ? 'spend_now_title' : 'spend_plan_title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.4 }}>
          {fill(t(kind === 'now' ? 'spend_now_line' : 'spend_plan_line'), { amount: fmtEur(kind === 'now' ? nowW : planKeep) })}
        </div>
      </div>
    </div>
  );

  // ── Cartão refeição — uma tira no topo, não um cartão no meio ──
  // É a única pergunta DIÁRIA da app ("posso pagar isto com o cartão?"),
  // enquanto o resto se pergunta uma vez por mês. Por isso fica acima da
  // dobra. O número é o que RESTA; recebes/gastaste passam a contexto.
  const openMealEdit = () => {
    setMealInput(fin.mealCard > 0 ? String(fin.mealCard) : '');
    setEditingMeal(true);
  };
  const mealStrip = editingMeal ? (
    <div className="card" style={{ marginBottom: 13 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--tx2)', marginBottom: 6 }}>{t('meal_card_lbl')}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="auth-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={mealInput}
          autoFocus
          onChange={(e) => setMealInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void saveMeal();
          }}
        />
        <button className="btn-primary" style={{ width: 'auto', padding: '0 20px', fontSize: 13 }} onClick={() => void saveMeal()}>
          {t('meal_card_save')}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn-secondary" style={{ padding: 10, fontSize: 12 }} onClick={() => setEditingMeal(false)}>
          {t('goal_cancel')}
        </button>
        {fin.mealCard > 0 && (
          <button className="btn-secondary" style={{ padding: 10, fontSize: 12, color: 'var(--re)' }} onClick={() => void clearMeal()}>
            {t('meal_card_clear')}
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 10, lineHeight: 1.5 }}>{t('meal_card_note')}</div>
    </div>
  ) : fs.mealCard ? (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 13 }}>
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M6 3v7a2.5 2.5 0 0 0 5 0V3M8.5 10v11" />
        <path d="M18 3c-1.7 1.2-2.5 3-2.5 5.5S16.3 12 18 12.5V21" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 800, letterSpacing: '.5px' }}>{t('meal_home_lbl')}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, margin: '1px 0 6px' }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', color: fs.mealCard.left < 0 ? 'var(--re)' : 'var(--tx)' }}>
            {fmtEur(fs.mealCard.left)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{fill(t('meal_strip_of'), { total: fmtEur(fs.mealCard.monthly) })}</span>
        </div>
        {fs.mealCard.monthly > 0 && (
          <div style={{ height: 4, background: 'var(--card2)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (fs.mealCard.spent / fs.mealCard.monthly) * 100)}%`,
                background: fs.mealCard.spent > fs.mealCard.monthly ? 'var(--re)' : 'var(--tx)',
                borderRadius: 2,
                transition: 'width .4s',
              }}
            />
          </div>
        )}
      </div>
      <button
        onClick={openMealEdit}
        style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', padding: 0, flexShrink: 0, alignSelf: 'flex-start' }}
      >
        {t('meal_home_edit')}
      </button>
    </div>
  ) : (
    // Sem cartão configurado isto não é informação, é uma pergunta — uma
    // linha discreta, não um cartão a ocupar o topo da página.
    <button
      onClick={openMealEdit}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        width: '100%',
        marginBottom: 13,
        padding: '9px 2px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'Manrope, sans-serif',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('meal_strip_ask')}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx2)' }}>{t('meal_home_set')} ›</span>
    </button>
  );

  return (
    <>
      {greeting}
      {mealStrip}

      {/* Défice do mês fechado — a Home não pode prometer poupança sem dizer
          primeiro que o mês fechou a vermelho. Vem antes do Money Leak e diz
          se os cortes propostos chegam (ou não) para equilibrar. */}
      {fs.monthDeficit > 0 && (
        <div className="card" style={{ marginBottom: 13, borderLeft: '3px solid var(--re)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.6px', color: 'var(--re)' }}>{t('home_deficit_lbl')}</div>
            <div className="leak-month-badge">{pastMonth}</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--re)', lineHeight: 1.1, marginBottom: 5 }}>−{fmtEur(fs.monthDeficit)}</div>
          <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5 }}>
            {fill(t('home_deficit_sub'), { month: pastMonth })}{' '}
            {fs.leakTotal <= 0
              ? t('home_deficit_nofix')
              : fs.leakTotal >= fs.monthDeficit
                ? fill(t('home_deficit_covered'), { amount: fmtEur(fs.leakTotal) })
                : fill(t('home_deficit_partial'), { amount: fmtEur(fs.leakTotal), rest: fmtEur(fs.monthDeficit - fs.leakTotal) })}
          </div>
        </div>
      )}

      {/* Money Leak */}
      {fs.leakTotal > 0 ? (
        <div className="money-leak-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="leak-badge">{t('leak_badge')}</div>
            <div className="leak-month-badge">{pastMonth}</div>
          </div>
          <div className="leak-value">{fmtEur0(fs.leakTotal)}/mês</div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 10 }}>{fill(t('leak_past'), { month: pastMonth })}</div>
          {topItems.map((item) => (
            <div key={item.id} className="leak-breakdown-row">
              <div className="leak-breakdown-icon">
                <CategoryIcon category={item.category} color="var(--tx2)" />
              </div>
              <div className="leak-breakdown-desc">
                {item.kind === 'sub_duplicate'
                  ? fill(t('leak_dup_label'), { count: item.count ?? 2, kindLabel: t(`kind_${item.dupKind}` as DictKey) })
                  : item.kind === 'subscription'
                    ? item.name
                    : item.reason === 'frequency'
                      ? `${t(`cat_${item.category}` as DictKey)} · ${fill(t('leak_times'), { n: item.count ?? 0 })}`
                      : t(`cat_${item.category}` as DictKey)}
              </div>
              <div className="leak-breakdown-amt">{fmtEur(item.monthlySaving)}/mês</div>
            </div>
          ))}
          {moreAmount > 0 && <div className="leak-more">{fill(t('leak_more'), { amount: fmtEur(moreAmount) })}</div>}
          <button className="leak-cta" onClick={() => setPlanOpen(true)}>
            {t('leak_cta')} →
          </button>
        </div>
      ) : fs.monthDeficit > 0 ? null : ( // "não perdeste dinheiro" seria falso num mês em défice
        <div className="leak-optimized">
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--tx)', marginBottom: 4 }}>{t('leak_none_title')}</div>
          <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{t('leak_none_sub')}</div>
        </div>
      )}

      {/* CASHFLOW — balcard com gráfico */}
      <div className="balcard" style={{ marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="ballbl">{t('cf_lbl')}</div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 20,
              background: 'color-mix(in srgb,var(--pr) 15%,transparent)',
              color: 'var(--pr)',
              border: '1px solid color-mix(in srgb,var(--pr) 25%,transparent)',
            }}
          >
            {currMonth} · em curso
          </div>
        </div>
        {/* Headline = saldo real da conta (não um número inventado). Se ainda
            não há âncora, mostra o movimento do mês corrente registado. */}
        {balanceSet && fs.currentBalance !== null ? (
          <>
            {/* O saldo vive AQUI e só aqui. Antes era repetido, com o mesmo
                rótulo e o mesmo valor, no cartão logo a seguir. */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
              <span className="ballbl">{t('bal_current')}</span>
              <button
                onClick={() => {
                  setBalanceInput(fs.currentBalance !== null ? String(fs.currentBalance) : '');
                  setEditingBalance(true);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', padding: 0 }}
              >
                {t('bal_edit')}
              </button>
            </div>
            <div className="balamt">{fmtEur(fs.currentBalance)}</div>
            <div className="balrow" style={{ marginBottom: 8 }}>
              <div className="bi">
                <label>{t('chart_income')}</label>
                <div className="bv iv">+{fmtEur(fs.manualIncomeThisMonth)}</div>
              </div>
              <div className="bi">
                <label>{t('chart_expenses')}</label>
                <div className="bv ev">−{fmtEur(fs.manualExpensesThisMonth)}</div>
              </div>
              <div className="bi">
                <label>{t('goals_reserved')}</label>
                <div className="bv sv">−{fmtEur(fs.allocatedTotal)}</div>
              </div>
              <div className="bi">
                <label>{t('goals_free')}</label>
                <div className="bv">{fmtEur(spendable)}</div>
              </div>
            </div>
          </>
        ) : manual.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 6, lineHeight: 1.5 }}>{fill(t('cf_empty_manual'), { month: currMonth })}</div>
        ) : (
          <>
            <div className="balamt">{fmtEur(fs.manualNet)}</div>
            <div className="balrow" style={{ marginBottom: 8 }}>
              <div className="bi">
                <label>{t('chart_income')}</label>
                <div className="bv iv">+{fmtEur(fs.manualIncomeThisMonth)}</div>
              </div>
              <div className="bi">
                <label>{t('chart_expenses')}</label>
                <div className="bv ev">−{fmtEur(fs.manualExpensesThisMonth)}</div>
              </div>
              <div className="bi">
                <label>{t('goals_reserved')}</label>
                <div className="bv sv">−{fmtEur(fs.allocatedTotal)}</div>
              </div>
            </div>
          </>
        )}
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
          {fill(t('cf_last_month'), { month: pastMonth })}{' '}
          <b style={{ color: fs.net >= 0 ? 'var(--gr)' : 'var(--tx)' }}>
            {fs.net >= 0 ? '+' : ''}
            {fmtEur(fs.net)}
          </b>
        </div>
        <CashflowChart points={chartPoints} labels={chartLabels} />
      </div>

      {/* QUANTO PODES GASTAR — um só modelo, ligado ao saldo real */}
      <div className="card" style={{ borderColor: 'color-mix(in srgb,var(--pr) 25%,transparent)' }}>
        <div style={{ fontSize: 11, color: 'var(--pr)', fontWeight: 800, letterSpacing: '.6px', marginBottom: 10 }}>
          {t('spend_lbl')} · {currMonth}
        </div>

        {!balanceSet || editingBalance ? (
          // Definir a âncora do saldo (sugere o saldo final do último extrato)
          <>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>{t('bal_set_title')}</div>
            <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 12 }}>{t('bal_set_sub')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="auth-input"
                type="number"
                inputMode="decimal"
                placeholder={t('bal_placeholder')}
                value={balanceInput}
                autoFocus
                onChange={(e) => setBalanceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveBalance();
                }}
              />
              <button className="btn-primary" style={{ width: 'auto', padding: '0 20px', fontSize: 13 }} onClick={() => void saveBalance()}>
                {t('bal_set_cta')}
              </button>
            </div>
            {editingBalance && (
              <button className="btn-secondary" style={{ marginTop: 8, padding: 10, fontSize: 12 }} onClick={() => setEditingBalance(false)}>
                {t('goal_cancel')}
              </button>
            )}
          </>
        ) : (
          <>
            {/* Sem repetir o saldo: este cartão responde só a "a que ritmo
                posso gastar", que é uma pergunta diferente. */}
            <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 12 }}>
              {fill(t('spend_frame_real'), { balance: fmtEur(fs.currentBalance ?? 0), reserved: fmtEur(fs.allocatedTotal), spendable: fmtEur(spendable), days })}
            </div>

            <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--pr)', letterSpacing: '-1px' }}>
              ~{fmtEur(nowW)}
              <span style={{ fontSize: 14, fontWeight: 800 }}>{t('pace_week')}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 1 }}>{fill(t('pace_day'), { amount: fmtEur(nowW / 7) })}</div>
            {scenarioBox('now')}
            {optSavings > 0.5 && scenarioBox('plan')}
            {optSavings > 0.5 && (
              <button
                onClick={() => setPlanOpen(true)}
                style={{
                  width: '100%',
                  marginTop: 11,
                  padding: 10,
                  background: 'var(--card2)',
                  border: '1px solid var(--b)',
                  borderRadius: 'var(--rs)',
                  color: 'var(--tx)',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'Manrope, sans-serif',
                }}
              >
                {t('spend_cut_cta')}
              </button>
            )}
            <div
              onClick={() => setShowHow(!showHow)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--tx2)' }}
            >
              <span>{t('spend_how')}</span>
              <span>{showHow ? '▴' : '▾'}</span>
            </div>
            {showHow && (
              <div style={{ marginTop: 10, padding: 12, background: 'var(--card2)', borderRadius: 'var(--rs)', fontSize: 12, lineHeight: 1.9, color: 'var(--tx2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('spend_row_balance')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--tx)' }}>{fmtEur(fs.currentBalance ?? 0)}</span>
                </div>
                {fs.allocatedTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('spend_row_reserved')}</span>
                    <span style={{ fontWeight: 700, color: 'var(--tx)' }}>−{fmtEur(fs.allocatedTotal)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--b)', marginTop: 5, paddingTop: 6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--tx)' }}>{t('spend_row_spendable')}</span>
                  <span style={{ fontWeight: 800, color: 'var(--tx)' }}>{fmtEur(spendable)}</span>
                </div>
                <div style={{ marginTop: 6, color: 'var(--tx3)' }}>{fill(t('spend_row_days'), { n: days })}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* PRÓXIMA META */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="sec" style={{ marginBottom: 0 }}>{t('next_goal_lbl')}</div>
          <Link href="/metas" style={{ fontSize: 12, fontWeight: 800, color: 'var(--pr)', textDecoration: 'none' }}>
            {t('next_goal_cta')}
          </Link>
        </div>
        {nextGoal ? (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ paddingTop: 2 }}>
                <GoalIcon name={nextGoal.name} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>{nextGoal.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--pr)' }}>{goalPct}%</div>
                </div>
                <div className="goal-prog">
                  <div className="goal-fill" style={{ width: `${goalPct}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--tx2)' }}>
                  <span>
                    {fmtEur(Number(nextGoal.current_eur))} / {fmtEur(Number(nextGoal.target_eur))}
                  </span>
                  <span>{goalDate}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>
                  {fill(t('goal_remaining'), { amount: fmtEur(Number(nextGoal.target_eur) - Number(nextGoal.current_eur)) })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{t('next_goal_none')}</div>
        )}
      </div>

      <PlanDrawer open={planOpen} onClose={() => setPlanOpen(false)} fin={fin} />
    </>
  );
}
