// Plano de poupança — o `PlanDrawer` da web. Aqui é um ecrã por cima dos
// separadores em vez de uma gaveta: num telemóvel, empurrar um ecrã é o gesto
// equivalente, e o conteúdo é longo de mais para meia altura.
//
// Resumo (total mensal, equivalente anual, progresso) + a regra 50/30/20 feita
// com os números reais + os itens do plano com Feito/Ignorar.

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../src/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { computeBudgetRule, projection, NEEDS_CATEGORIES, type DictKey } from '@optifi/core';
import { useFinance } from '../src/lib/finance';
import { useI18n } from '../src/lib/i18n';
import { useTheme } from '../src/lib/theme-context';
import { fill, fmtEur, fmtEur0, monthLabel } from '@optifi/core';
import { alpha, Button, Card, Screen } from '../src/ui';
import { CategoryIcon } from '../src/CategoryIcon';

/** O `<details class="invest-more">` da web: uma linha que abre ao toque. */
function InvestMore({ text }: { text: string }) {
  const t0 = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 7 }}>
      <Pressable onPress={() => setOpen((v) => !v)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path d="M3 17 9 11l4 4 8-8" fill="none" stroke={t0.tx3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 7h7v7" fill="none" stroke={t0.tx3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t0.tx3 }}>{t('ins_invest_toggle')}</Text>
        <Text style={{ fontSize: 11, color: t0.tx3 }}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <Text style={{ fontSize: 11, color: t0.tx2, lineHeight: 17, marginTop: 6 }}>{text}</Text>
      ) : null}
    </View>
  );
}

/** A caixa cinzenta com o ícone de subida usada nas projeções. */
function InvestNote({ text, small }: { text: string; small?: boolean }) {
  const t0 = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: small ? 6 : 7,
        alignItems: 'flex-start',
        marginTop: small ? 10 : 12,
        paddingVertical: small ? 9 : 10,
        paddingHorizontal: small ? 11 : 12,
        borderRadius: t0.rs,
        backgroundColor: t0.card2,
      }}
    >
      <Svg width={small ? 13 : 15} height={small ? 13 : 15} viewBox="0 0 24 24" style={{ marginTop: 1 }}>
        <Path d="M3 17 9 11l4 4 8-8" fill="none" stroke={t0.tx2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 7h7v7" fill="none" stroke={t0.tx2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={{ flex: 1, fontSize: small ? 11 : 12, fontWeight: '700', color: t0.tx2, lineHeight: small ? 16 : 18 }}>{text}</Text>
    </View>
  );
}

export default function Plano() {
  const t0 = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fin = useFinance();
  const { fin: snap, loading } = fin;
  const { t } = useI18n();

  if (loading || !snap) {
    return (
      <Screen t={t0}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t0.pr} />
        </View>
      </Screen>
    );
  }

  const { imp, fs, analysis, planState, categorySpend } = snap;
  const pastMonth = imp ? monthLabel(imp.statement_month) : '';
  const currMonth = monthLabel(snap.planMonth);

  const header = (
    <View style={{ marginBottom: 13 }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5, marginBottom: 2 }}>
        {`${t('pd_title')} · ${currMonth}`}
      </Text>
      {imp ? <Text style={{ fontSize: 12, color: t0.tx2 }}>{fill(t('pd_sub'), { month: pastMonth })}</Text> : null}
    </View>
  );

  if (!imp || !fs || !analysis) {
    return (
      <Screen t={t0}>
        <ScrollView contentContainerStyle={{ padding: 13, paddingTop: insets.top + 12, paddingBottom: 28 }}>
          {header}
          <Card t={t0} style={{ marginBottom: 11 }}>
            <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 19 }}>{t('empty_insights')}</Text>
          </Card>
          <Button t={t0} label={t('goal_cancel')} onPress={() => router.back()} variant="ghost" />
        </ScrollView>
      </Screen>
    );
  }

  // Regra 50/30/20 personalizada: os TEUS essenciais definem os números.
  // Assim que estás a gerir o mês corrente — recebeste o salário e/ou já lanças
  // gastos — a regra age sobre ESSE mês. Se ainda não lançaste o salário mas já
  // há gastos, usa-se o rendimento recorrente como ESTIMATIVA, com etiqueta.
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

  // Em mês corrente só mostramos a regra depois de os essenciais PRINCIPAIS
  // estarem lançados — senão a fatia "investir" parece grande cedo demais.
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
    <Screen t={t0}>
      <ScrollView contentContainerStyle={{ padding: 13, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }}>
        {header}

        {analysis.planItems.length === 0 ? (
          <Card t={t0} style={{ marginBottom: 11 }}>
            <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18 }}>{t('leak_none_sub')}</Text>
          </Card>
        ) : (
          <>
            {/* Resumo */}
            <Card t={t0} style={{ marginBottom: 11, borderLeftWidth: 3, borderLeftColor: t0.tx }}>
              <View style={{ backgroundColor: t0.card, borderWidth: 1, borderColor: t0.b, borderRadius: t0.rs, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14 }}>
                <Text style={{ fontSize: 13, lineHeight: 21, color: t0.tx2 }}>
                  {fill(t('pd_explain'), { pastMonth, planMonth: currMonth, expenses: fmtEur(fs.expenses), saving: fmtEur(analysis.baseLeak) })}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: t0.tx3, letterSpacing: 0.6, marginBottom: 3 }}>{t('pd_total_lbl')}</Text>
                  <Text style={{ fontSize: 30, fontWeight: '900', color: t0.tx, letterSpacing: -1 }}>{fmtEur0(analysis.baseLeak)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: t0.tx3, letterSpacing: 0.6, marginBottom: 3 }}>{t('pd_annual_lbl')}</Text>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: t0.tx }}>
                    {fill(t('pd_annual_val'), { amount: fmtEur0(analysis.baseLeak * 12) })}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 11, color: t0.tx3, marginBottom: 6 }}>{fill(t('pd_progress'), { pct: progress })}</Text>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t0.b, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${progress}%`, borderRadius: 3, backgroundColor: t0.pr }} />
              </View>

              {analysis.baseLeak > 0 ? (
                <InvestNote
                  text={fill(t('pd_leak_invest'), {
                    lost: fmtEur0(analysis.baseLeak),
                    rate: projection(analysis.baseLeak).rate,
                    fv10: fmtEur0(projection(analysis.baseLeak).fv10),
                  })}
                />
              ) : null}
            </Card>

            {/* A TUA REGRA — 50/30/20 sobre as finanças reais deste utilizador */}
            {rule && !essentialsReady ? (
              <Card t={t0} style={{ marginBottom: 11 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: t0.tx3, letterSpacing: 0.6, marginBottom: 4 }}>{t('rule_lbl')}</Text>
                <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18 }}>{fill(t('rule_pending_essentials'), { month: currMonth })}</Text>
              </Card>
            ) : rule ? (
              <Card t={t0} style={{ marginBottom: 11 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: t0.tx3, letterSpacing: 0.6, marginBottom: 2 }}>{t('rule_lbl')}</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: t0.tx, letterSpacing: -0.5, marginBottom: 4 }}>
                  {`${rule.needsPct}/${rule.wantsPct}/${rule.savingsPct}`}
                </Text>
                <Text style={{ fontSize: 11, color: t0.tx2, lineHeight: 17, marginBottom: 4 }}>{t('rule_sub')}</Text>
                <Text style={{ fontSize: 10, color: t0.tx3, marginBottom: 10 }}>{ruleBasis}</Text>

                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: t0.tx2 }}>{fill(t('rule_needs'), { pct: rule.needsPct })}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx }}>{fmtEur0(rule.needsEur)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={{ flex: 1, fontSize: 12, color: t0.tx2 }}>{fill(t('rule_wants'), { pct: rule.wantsPct, sug: fmtEur0(rule.wantsEur) })}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: rule.wantsActualEur > rule.wantsEur ? t0.re : t0.tx }}>
                      {fmtEur0(rule.wantsActualEur)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: t0.tx2 }}>{fill(t('rule_savings'), { pct: rule.savingsPct })}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: t0.gr }}>+{fmtEur0(rule.savingsEur)}</Text>
                  </View>
                </View>

                {rule.savingsEur > 0 ? (
                  <InvestNote
                    small
                    text={fill(t('rule_invest'), {
                      amount: fmtEur0(rule.savingsEur),
                      rate: projection(rule.savingsEur).rate,
                      fv10: fmtEur0(projection(rule.savingsEur).fv10),
                    })}
                  />
                ) : null}
                <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 10, lineHeight: 15 }}>{t('rule_note')}</Text>
              </Card>
            ) : null}

            {/* Itens do plano */}
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
              const line = isDup
                ? fill(t('leak_dup_line'), { keepName: item.keepName ?? '', keepPrice: fmtEur(item.keepPrice ?? 0), others: item.name ?? '' })
                : isSub
                  ? `${fmtEur(item.spend)}/mês · ${fmtEur(item.spend * 12)}/ano`
                  : item.reason === 'frequency'
                    ? fill(t('leak_freq_line'), { n: item.count ?? 0, cat: t(`cat_${item.category}` as DictKey), month: pastMonth, spend: fmtEur(item.spend), saving: fmtEur(item.monthlySaving) })
                    : fill(t('leak_item_line'), { cat: t(`cat_${item.category}` as DictKey), spend: fmtEur(item.spend), cap: fmtEur(item.capEur) });
              return (
                <Card key={item.id} t={t0} style={{ marginBottom: 11, opacity: resolved ? 0.55 : 1 }}>
                  <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginBottom: 11 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t0.pr, 13) }}>
                      <CategoryIcon category={item.category} color={t0.pr} size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: t0.tx }}>{title}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx, marginTop: 1 }}>{fmtEur0(item.monthlySaving)}/mês</Text>
                      <Text style={{ fontSize: 11, color: t0.tx3, marginTop: 3, lineHeight: 16 }}>{line}</Text>
                      <InvestMore
                        text={fill(t('ins_invest_multi'), {
                          monthly: fmtEur(item.monthlySaving),
                          rate: 7,
                          fv10: fmtEur0(item.fv10),
                          fv15: fmtEur0(item.fv15),
                          fv20: fmtEur0(item.fv20),
                        })}
                      />
                    </View>
                    {resolved ? (
                      <Text style={{ fontSize: 10, fontWeight: '800', color: t0.tx3 }}>
                        {st === 'done' ? t('plan_state_done') : t('plan_state_ignored')}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {resolved ? (
                      <Pressable
                        onPress={() => void fin.setPlanItemState(item.id, 'active', item.category, item.monthlySaving)}
                        style={{ flex: 1, paddingVertical: 11, borderRadius: t0.rs, alignItems: 'center', borderWidth: 1, borderColor: t0.b, backgroundColor: t0.card2 }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx2 }}>{t('plan_restore')}</Text>
                      </Pressable>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => void fin.setPlanItemState(item.id, 'done', item.category, item.monthlySaving)}
                          style={{ flex: 1, paddingVertical: 11, borderRadius: t0.rs, alignItems: 'center', borderWidth: 1, borderColor: t0.b, backgroundColor: t0.card2 }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx }}>✓ {t('plan_done')}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void fin.setPlanItemState(item.id, 'ignored', item.category, item.monthlySaving)}
                          style={{ flex: 1, paddingVertical: 11, borderRadius: t0.rs, alignItems: 'center', borderWidth: 1, borderColor: t0.b, backgroundColor: t0.card2 }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx2 }}>{t('plan_ignore')}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </Card>
              );
            })}
          </>
        )}

        <View style={{ height: 4 }} />
        <Button t={t0} label={t('wiz_back')} onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </Screen>
  );
}
