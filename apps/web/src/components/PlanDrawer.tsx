'use client';

// Drawer do plano de poupança — o conteúdo do protótipo sobre dados reais:
// resumo (total mensal, equivalente anual, progresso) + itens com Feito/Ignorar.

import { computeBudgetRule, projection, NEEDS_CATEGORIES } from '@optifi/core';
import { useI18n, type DictKey } from '@/lib/i18n';
import { fmtEur, fmtEur0, fill, monthLabel } from '@/lib/format';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Drawer } from '@/components/Drawer';
import type { Finance } from '@/lib/useFinance';

export function PlanDrawer({ open, onClose, fin }: { open: boolean; onClose: () => void; fin: Finance }) {
  const { t, lang } = useI18n();
  const { imp, fs, analysis, planState, planMonth, categorySpend, setPlanItemState } = fin;
  if (!imp || !fs || !analysis) return null;

  const pastMonth = monthLabel(imp.statement_month, lang);
  const currMonth = monthLabel(planMonth, lang);

  // Regra 50/30/20 personalizada: os TEUS essenciais definem os números.
  // Assim que estás a gerir o mês corrente — recebeste o salário e/ou já lanças
  // gastos — a regra age sobre ESSE mês. O rendimento base é o salário que
  // registaste; se ainda não o lançaste mas já há gastos deste mês, usamos o
  // rendimento recorrente (último extrato) como ESTIMATIVA, para a regra
  // funcionar já para o mês, com etiqueta transparente. Senão, mês analisado.
  const hasCurrentIncome = fs.manualIncomeThisMonth > 0;
  const currentIncome = hasCurrentIncome ? fs.manualIncomeThisMonth : fs.income;
  const useCurrentMonth = (hasCurrentIncome || fs.manualExpensesThisMonth > 0) && currentIncome > 0;
  const rule = useCurrentMonth
    ? computeBudgetRule(currentIncome, fs.manualCategorySpend)
    : computeBudgetRule(fs.income, categorySpend);
  const ruleBasis = !useCurrentMonth
    ? fill(t('rule_basis_past'), { month: pastMonth })
    : hasCurrentIncome
      ? fill(t('rule_basis_current'), { month: currMonth })
      : fill(t('rule_basis_current_est'), { month: currMonth, income: fmtEur0(currentIncome) });
  // Em modo mês-corrente só mostramos a regra depois de os essenciais PRINCIPAIS
  // estarem lançados — senão a fatia "investir" parece grande cedo demais.
  // Basta a renda (habitação) ou já ter ≥50% dos essenciais do mês de referência.
  const NEEDS = NEEDS_CATEGORIES as readonly string[];
  const housingLogged = fs.manualCategorySpend.some((c) => c.categoryId === 'habitacao' && c.amount > 0);
  const pastEssentials = categorySpend.filter((c) => NEEDS.includes(c.categoryId)).reduce((a, b) => a + b.amount, 0);
  const currentEssentials = fs.manualCategorySpend.filter((c) => NEEDS.includes(c.categoryId)).reduce((a, b) => a + b.amount, 0);
  const essentialsReady = !useCurrentMonth || housingLogged || (pastEssentials > 0 && currentEssentials >= 0.5 * pastEssentials);
  const resolvedSaving = analysis.planItems
    .filter((p) => planState[p.id]?.state === 'done' || planState[p.id]?.state === 'ignored')
    .reduce((a, b) => a + b.monthlySaving, 0);
  const progress = analysis.baseLeak > 0 ? Math.round((resolvedSaving / analysis.baseLeak) * 100) : 0;

  return (
    <Drawer open={open} onClose={onClose} title={`${t('pd_title')} · ${currMonth}`} sub={fill(t('pd_sub'), { month: pastMonth })}>
      {analysis.planItems.length === 0 ? (
        <div className="card" style={{ fontSize: 12, color: 'var(--tx2)' }}>{t('leak_none_sub')}</div>
      ) : (
        <>
          <div className="plan-summary-card">
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--b)',
                borderRadius: 'var(--rs)',
                padding: '12px 14px',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--tx2)',
                marginBottom: 14,
              }}
            >
              {fill(t('pd_explain'), { pastMonth, planMonth: currMonth, expenses: fmtEur(fs.expenses), saving: fmtEur(analysis.baseLeak) })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tx3)', letterSpacing: '.6px', marginBottom: 3 }}>{t('pd_total_lbl')}</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--tx)', letterSpacing: '-1px' }}>{fmtEur0(analysis.baseLeak)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tx3)', letterSpacing: '.6px', marginBottom: 3 }}>{t('pd_annual_lbl')}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--tx)' }}>{fill(t('pd_annual_val'), { amount: fmtEur0(analysis.baseLeak * 12) })}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>{fill(t('pd_progress'), { pct: progress })}</div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--b)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--pr)', borderRadius: 3, transition: 'width .5s' }} />
            </div>
            {analysis.baseLeak > 0 && (() => {
              const proj = projection(analysis.baseLeak);
              return (
                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 12, padding: '10px 12px', borderRadius: 'var(--rs)', background: 'var(--card2)', lineHeight: 1.5 }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M3 17 9 11l4 4 8-8" />
                    <path d="M14 7h7v7" />
                  </svg>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx2)' }}>
                    {fill(t('pd_leak_invest'), { lost: fmtEur0(analysis.baseLeak), rate: proj.rate, fv10: fmtEur0(proj.fv10) })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* A TUA REGRA — 50/30/20 aplicada às finanças reais deste utilizador.
              Em mês corrente, só depois de os essenciais principais estarem lançados. */}
          {rule && !essentialsReady ? (
            <div className="card">
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tx3)', letterSpacing: '.6px', marginBottom: 4 }}>{t('rule_lbl')}</div>
              <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5 }}>{fill(t('rule_pending_essentials'), { month: currMonth })}</div>
            </div>
          ) : rule && (
            <div className="card">
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tx3)', letterSpacing: '.6px', marginBottom: 2 }}>{t('rule_lbl')}</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 4 }}>
                {rule.needsPct}/{rule.wantsPct}/{rule.savingsPct}
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 4 }}>{t('rule_sub')}</div>
              <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 10 }}>{ruleBasis}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--tx2)' }}>{fill(t('rule_needs'), { pct: rule.needsPct })}</span>
                  <b>{fmtEur0(rule.needsEur)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--tx2)' }}>{fill(t('rule_wants'), { pct: rule.wantsPct, sug: fmtEur0(rule.wantsEur) })}</span>
                  <b style={{ color: rule.wantsActualEur > rule.wantsEur ? 'var(--re)' : 'var(--tx)' }}>{fmtEur0(rule.wantsActualEur)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--tx2)' }}>{fill(t('rule_savings'), { pct: rule.savingsPct })}</span>
                  <b style={{ color: 'var(--gr)' }}>+{fmtEur0(rule.savingsEur)}</b>
                </div>
              </div>
              {rule.savingsEur > 0 && (() => {
                const proj = projection(rule.savingsEur);
                return (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 10, padding: '9px 11px', borderRadius: 'var(--rs)', background: 'var(--card2)', fontSize: 11, fontWeight: 700, color: 'var(--tx2)', lineHeight: 1.45 }}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M3 17 9 11l4 4 8-8" />
                      <path d="M14 7h7v7" />
                    </svg>
                    <span>{fill(t('rule_invest'), { amount: fmtEur0(rule.savingsEur), rate: proj.rate, fv10: fmtEur0(proj.fv10) })}</span>
                  </div>
                );
              })()}
              <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 10, lineHeight: 1.5 }}>{t('rule_note')}</div>
            </div>
          )}

          {analysis.planItems.map((item) => {
            const st = planState[item.id]?.state;
            const resolved = st === 'done' || st === 'ignored';
            const isSub = item.kind === 'subscription';
            const isDup = item.kind === 'sub_duplicate';
            const title = isDup
              ? fill(t('plan_item_dup'), { count: item.count ?? 2, kindLabel: t(`kind_${item.dupKind}` as DictKey) })
              : isSub
                ? fill(t('plan_item_cancel_sub'), { name: item.name ?? '' })
                : fill(t('plan_item_cap'), { cat: t(`cat_${item.category}` as DictKey) });
            return (
              <div key={item.id} className="card" style={{ opacity: resolved ? 0.55 : 1 }}>
                <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 11 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'color-mix(in srgb, var(--pr) 13%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon category={item.category} color="var(--pr)" size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx)', marginTop: 1 }}>{fmtEur0(item.monthlySaving)}/mês</div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 3 }}>
                      {isDup
                        ? fill(t('leak_dup_line'), { keepName: item.keepName ?? '', keepPrice: fmtEur(item.keepPrice ?? 0), others: item.name ?? '' })
                        : isSub
                          ? `${fmtEur(item.spend)}/mês · ${fmtEur(item.spend * 12)}/ano`
                          : item.reason === 'frequency'
                            ? fill(t('leak_freq_line'), { n: item.count ?? 0, cat: t(`cat_${item.category}` as DictKey), spend: fmtEur(item.spend), saving: fmtEur(item.monthlySaving) })
                            : fill(t('leak_item_line'), { cat: t(`cat_${item.category}` as DictKey), spend: fmtEur(item.spend), cap: fmtEur(item.capEur) })}
                    </div>
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
                          monthly: fmtEur(item.monthlySaving),
                          rate: 7,
                          fv10: fmtEur0(item.fv10),
                          fv15: fmtEur0(item.fv15),
                          fv20: fmtEur0(item.fv20),
                        })}
                      </div>
                    </details>
                  </div>
                  {resolved && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--tx3)' }}>
                      {st === 'done' ? t('plan_state_done') : t('plan_state_ignored')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: resolved ? '1fr' : '1fr 1fr', gap: 8 }}>
                  {resolved ? (
                    <button className="pill-btn" style={{ padding: 11 }} onClick={() => void setPlanItemState(item.id, 'active', item.category, item.monthlySaving)}>
                      {t('plan_restore')}
                    </button>
                  ) : (
                    <>
                      <button
                        className="pill-btn"
                        style={{ padding: 11, color: 'var(--tx)', fontSize: 13 }}
                        onClick={() => void setPlanItemState(item.id, 'done', item.category, item.monthlySaving)}
                      >
                        ✓ {t('plan_done')}
                      </button>
                      <button className="pill-btn" style={{ padding: 11, fontSize: 13 }} onClick={() => void setPlanItemState(item.id, 'ignored', item.category, item.monthlySaving)}>
                        {t('plan_ignore')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </Drawer>
  );
}
