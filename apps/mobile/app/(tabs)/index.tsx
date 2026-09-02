// Início — a mesma ordem da web: saudação → cartão refeição → défice do mês →
// onde podes poupar → entradas e saídas (com gráfico) → quanto podes gastar →
// próxima meta. Os números vêm todos do motor; nada aqui é calculado à parte.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '../../src/Text';
import { useRouter } from 'expo-router';
import { daysLeftInMonth, importCadence, type DictKey } from '@optifi/core';
import { useFinance } from '../../src/lib/finance';
import { useI18n } from '../../src/lib/i18n';
import { fill, fmtEur, fmtEur0, monthLabel, monthShort } from '@optifi/core';
import { alpha, Button, Card, Screen } from '../../src/ui';
import { CashflowChart, ChartLegend, type CashflowPoint } from '../../src/CashflowChart';
import { CategoryIcon } from '../../src/CategoryIcon';
import { CheckIcon, FlameIcon, MealIcon } from '../../src/icons';
import { GoalIcon } from '../../src/GoalIcon';
import { useTheme } from '../../src/lib/theme-context';


/** Campo de dinheiro: teclado numérico e vírgula aceite, como se escreve cá. */
function MoneyInput({
  value,
  onChangeText,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
}) {
  const t0 = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t0.tx3}
      keyboardType="decimal-pad"
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      autoFocus
      style={{
        flex: 1,
        backgroundColor: t0.bg2,
        borderColor: t0.b,
        borderWidth: 1,
        borderRadius: t0.rs,
        paddingHorizontal: 13,
        paddingVertical: 12,
        fontSize: 15,
        color: t0.tx,
      }}
    />
  );
}

export default function Home() {
  const t0 = useTheme();
  const router = useRouter();
  const win = useWindowDimensions();
  const { t } = useI18n();
  const fin = useFinance();
  const { fin: snap, error, loading, reload } = fin;

  const [refreshing, setRefreshing] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [editingBalance, setEditingBalance] = useState(false);
  // Ao acertar o saldo, quais das despesas por pagar o utilizador diz que já
  // saíram. A app não adivinha isto: só ele sabe o que o banco já debitou.
  const [paidNow, setPaidNow] = useState<string[]>([]);
  const [mealInput, setMealInput] = useState('');
  const [editingMeal, setEditingMeal] = useState(false);
  const [addingSubs, setAddingSubs] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const chartPoints: CashflowPoint[] = useMemo(() => {
    if (!snap) return [];
    const pts: CashflowPoint[] = snap.history.map((h) => ({
      label: monthShort(h.statement_month),
      income: Number(h.income),
      expenses: Number(h.expenses),
    }));
    const s = snap.fs;
    if (s && (s.manualIncomeThisMonth > 0 || s.manualExpensesThisMonth > 0)) {
      pts.push({
        label: monthShort(snap.planMonth),
        income: s.manualIncomeThisMonth,
        expenses: s.manualExpensesThisMonth,
      });
    }
    return pts;
  }, [snap]);

  if (loading) {
    return (
      <Screen t={t0}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t0.pr} />
        </View>
      </Screen>
    );
  }

  const hour = new Date().getHours();
  const greetKey: DictKey = hour < 12 ? 'greeting_morning' : hour < 20 ? 'greeting_afternoon' : 'greeting_evening';
  const currMonth = snap ? monthLabel(snap.planMonth) : '';
  const cadence = importCadence((snap?.history ?? []).map((h) => h.statement_month), new Date());

  const pad = { paddingHorizontal: 12, paddingTop: 13, paddingBottom: 32 };
  // O gráfico desenha-se em pixéis: largura do ecrã menos as margens do ecrã
  // (12×2, como o `.main` da web) e o interior do cartão (15×2).
  const chartWidth = win.width - 24 - 30;

  const greeting = (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5 }}>
          {t(greetKey)}
          {snap?.profileName ? `, ${snap.profileName.split(' ')[0]}` : ''}
        </Text>
        {cadence.streak >= 2 ? (
          <View
            accessibilityLabel={t('streak_tip')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: alpha(t0.ye, 15),
            }}
          >
            <FlameIcon color={t0.ye} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: t0.ye }}>
              {fill(t('streak_badge'), { n: cadence.streak })}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: 12, color: t0.tx2, marginTop: 2 }}>{fill(t('home_sub'), { month: currMonth })}</Text>
    </View>
  );

  const errorCard = error ? (
    <Card t={t0} style={{ marginBottom: 12 }}>
      <Text style={{ color: t0.re, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>{error}</Text>
      <Button t={t0} label={t('common_retry')} onPress={() => void reload()} variant="ghost" />
    </Card>
  ) : null;

  const fs = snap?.fs ?? null;
  const analysis = snap?.analysis ?? null;

  if (!snap || !fs || !snap.imp || !analysis) {
    return (
      <Screen t={t0}>
        <ScrollView
          contentContainerStyle={pad}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t0.pr} />}
        >
          {greeting}
          {errorCard}
          <Card t={t0}>
            <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 19, marginBottom: 14 }}>{t('empty_home')}</Text>
            <Button t={t0} label={t('wiz_title')} onPress={() => router.push('/importar')} />
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  const catLabel = (id: string) => t(`cat_${id}` as DictKey);
  const pastMonth = monthLabel(snap.imp.statement_month);

  const activeItems = analysis.planItems.filter((p) => {
    const st = snap.planState[p.id]?.state;
    return st !== 'done' && st !== 'ignored';
  });
  const topItems = activeItems.slice(0, 3);
  const moreAmount = activeItems.slice(3).reduce((a, b) => a + b.monthlySaving, 0);

  // ── Quanto podes gastar ──
  const days = daysLeftInMonth(new Date());
  const optSavings = fs.leakTotal + fs.limitsSavingsPotential;
  const spendable = fs.spendableNow ?? 0;
  // O ritmo semanal nunca é negativo — não se pode gastar menos que nada.
  const nowW = (Math.max(0, spendable) / days) * 7;
  // Cortar não deixa gastar MAIS: deixa ficar com mais no fim do mês. O que o
  // plano vale nos dias que faltam é a poupança mensal proporcional a eles.
  const monthDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const planKeep = optSavings * (days / monthDays);

  const unpaidRows = snap.manual.filter((m) => m.entry_type === 'expense' && !m.meal_card && !m.paid_at);
  const subsDue = fs.subsPending;

  const addSubsToList = async () => {
    setAddingSubs(true);
    for (const s of subsDue.items) {
      await fin.addManual({ type: 'expense', amount: s.price, category: 'subscricoes', note: s.name, paid: false });
    }
    setAddingSubs(false);
  };

  const saveBalance = async () => {
    const v = parseFloat(balanceInput.replace(',', '.'));
    if (Number.isNaN(v)) return;
    // Marcar primeiro as que já saíram: o saldo copiado do banco já as reflete
    // e, sem isto, continuavam a descontar do disponível.
    for (const id of paidNow) await fin.setManualPaid(id, true);
    await fin.setBalance(v);
    setEditingBalance(false);
    setBalanceInput('');
    setPaidNow([]);
  };

  const saveMeal = async () => {
    const v = parseFloat(mealInput.replace(',', '.'));
    if (Number.isNaN(v) || v < 0) return;
    await fin.setMealCardValue(v);
    setEditingMeal(false);
    setMealInput('');
  };

  const openMealEdit = () => {
    setMealInput(snap.mealCard > 0 ? String(snap.mealCard) : '');
    setEditingMeal(true);
  };

  // Próxima meta: prazo mais próximo, por atingir.
  const nextGoal = [...snap.goals]
    .filter((g) => Number(g.current_eur) < Number(g.target_eur))
    .sort(
      (a, b) =>
        (a.target_year ?? 9999) * 100 + (a.target_month ?? 12) - ((b.target_year ?? 9999) * 100 + (b.target_month ?? 12)),
    )[0];
  const goalPct = nextGoal
    ? Math.min(100, Math.round((Number(nextGoal.current_eur) / Number(nextGoal.target_eur)) * 100))
    : 0;
  const goalDate =
    nextGoal?.target_month && nextGoal.target_year
      ? `${monthShort(`${nextGoal.target_year}-${String(nextGoal.target_month).padStart(2, '0')}`)} ${nextGoal.target_year}`
      : '';

  // ── Cartão refeição — uma tira no topo, não um cartão no meio ──
  // É a única pergunta DIÁRIA da app ("posso pagar isto com o cartão?"),
  // enquanto o resto se pergunta uma vez por mês.
  const mealStrip = editingMeal ? (
    <Card t={t0} style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx2, marginBottom: 7 }}>{t('meal_card_lbl')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <MoneyInput value={mealInput} onChangeText={setMealInput} placeholder="0,00" onSubmit={() => void saveMeal()} />
        <Pressable
          onPress={() => void saveMeal()}
          style={{
            justifyContent: 'center',
            paddingHorizontal: 18,
            borderRadius: t0.rs,
            backgroundColor: t0.pr,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{t('meal_card_save')}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
        <Pressable onPress={() => setEditingMeal(false)} hitSlop={6}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx2 }}>{t('goal_cancel')}</Text>
        </Pressable>
        {snap.mealCard > 0 ? (
          <Pressable
            onPress={() => {
              void fin.setMealCardValue(0);
              setEditingMeal(false);
              setMealInput('');
            }}
            hitSlop={6}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: t0.re }}>{t('meal_card_clear')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ fontSize: 11, color: t0.tx3, lineHeight: 16, marginTop: 12 }}>{t('meal_card_note')}</Text>
    </Card>
  ) : fs.mealCard ? (
    <Card t={t0} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 13, marginBottom: 12 }}>
      <View style={{ paddingTop: 2 }}>
        <MealIcon color={t0.tx2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 10, color: t0.tx3, fontWeight: '800', letterSpacing: 0.5 }}>{t('meal_home_lbl')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 1, marginBottom: 6 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              letterSpacing: -0.5,
              color: fs.mealCard.left < 0 ? t0.re : t0.tx,
            }}
          >
            {fmtEur(fs.mealCard.left)}
          </Text>
          <Text style={{ fontSize: 11, color: t0.tx3 }}>{fill(t('meal_strip_of'), { total: fmtEur(fs.mealCard.monthly) })}</Text>
        </View>
        {fs.mealCard.monthly > 0 ? (
          <View style={{ height: 4, backgroundColor: t0.card2, borderRadius: 2, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, (fs.mealCard.spent / fs.mealCard.monthly) * 100)}%`,
                backgroundColor: fs.mealCard.spent > fs.mealCard.monthly ? t0.re : t0.tx,
                borderRadius: 2,
              }}
            />
          </View>
        ) : null}
      </View>
      <Pressable onPress={openMealEdit} hitSlop={8}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t0.tx3 }}>{t('meal_home_edit')}</Text>
      </Pressable>
    </Card>
  ) : (
    // Sem cartão configurado isto não é informação, é uma pergunta — uma linha
    // discreta, não um cartão a ocupar o topo do ecrã.
    <Pressable
      onPress={openMealEdit}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 12,
        paddingVertical: 9,
        paddingHorizontal: 2,
      }}
    >
      <Text style={{ fontSize: 12, color: t0.tx3, flex: 1 }}>{t('meal_strip_ask')}</Text>
      <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx2 }}>{t('meal_home_set')} ›</Text>
    </Pressable>
  );

  return (
    <Screen t={t0}>
      <ScrollView
        contentContainerStyle={pad}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t0.pr} />}
      >
        {greeting}
        {errorCard}
        {mealStrip}

        {/* Défice do mês fechado — o Início não pode prometer poupança sem dizer
            primeiro que o mês fechou a vermelho. */}
        {fs.monthDeficit > 0 ? (
          <Card t={t0} style={{ marginBottom: 12, borderLeftWidth: 3, borderLeftColor: t0.re }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: t0.re }}>
                {t('home_deficit_lbl')}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: t0.tx3,
                  backgroundColor: t0.card2,
                  borderRadius: 20,
                  paddingHorizontal: 9,
                  paddingVertical: 2,
                  overflow: 'hidden',
                }}
              >
                {pastMonth}
              </Text>
            </View>
            <Text style={{ fontSize: 26, fontWeight: '900', color: t0.re, marginTop: 6, marginBottom: 5 }}>
              −{fmtEur(fs.monthDeficit)}
            </Text>
            <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18 }}>
              {fill(t('home_deficit_sub'), { month: pastMonth })}{' '}
              {fs.leakTotal <= 0
                ? t('home_deficit_nofix')
                : fs.leakTotal >= fs.monthDeficit
                  ? fill(t('home_deficit_covered'), { amount: fmtEur(fs.leakTotal) })
                  : fill(t('home_deficit_partial'), {
                      amount: fmtEur(fs.leakTotal),
                      rest: fmtEur(fs.monthDeficit - fs.leakTotal),
                    })}
            </Text>
          </Card>
        ) : null}

        {/* Onde podes poupar */}
        {fs.leakTotal > 0 ? (
          <Card t={t0} style={{ marginBottom: 12, borderLeftWidth: 3, borderLeftColor: t0.re }}>
            <Text
              style={{
                alignSelf: 'flex-start',
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: t0.re,
                backgroundColor: alpha(t0.re, 14),
                borderWidth: 1,
                borderColor: alpha(t0.re, 32),
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 3,
                overflow: 'hidden',
              }}
            >
              {t('leak_badge')}
            </Text>
            <Text style={{ fontSize: 40, fontWeight: '900', color: t0.re, letterSpacing: -1.5, marginTop: 8 }}>
              {fmtEur0(fs.leakTotal)}
              <Text style={{ fontSize: 16, fontWeight: '800' }}>/mês</Text>
            </Text>
            <Text style={{ fontSize: 11, color: t0.tx3, marginTop: 4, marginBottom: 8 }}>
              {fill(t('leak_past'), { month: pastMonth })}
            </Text>
            {topItems.map((item, i) => (
              <View
                key={item.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 9,
                  paddingVertical: 8,
                  borderBottomWidth: i === topItems.length - 1 ? 0 : 1,
                  borderBottomColor: t0.b,
                }}
              >
                <CategoryIcon category={item.category} color={t0.tx2} />
                <Text style={{ flex: 1, fontSize: 12, color: t0.tx2 }} numberOfLines={1}>
                  {item.kind === 'sub_duplicate'
                    ? fill(t('leak_dup_label'), {
                        count: item.count ?? 2,
                        kindLabel: t(`kind_${item.dupKind}` as DictKey),
                      })
                    : item.kind === 'subscription'
                      ? (item.name ?? catLabel(item.category))
                      : item.reason === 'frequency'
                        ? `${catLabel(item.category)} · ${fill(t('leak_times'), { n: item.count ?? 0 })}`
                        : catLabel(item.category)}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: t0.re }}>{fmtEur(item.monthlySaving)}/mês</Text>
              </View>
            ))}
            {moreAmount > 0 ? (
              <Text style={{ fontSize: 11, color: t0.tx3, marginTop: 6 }}>
                {fill(t('leak_more'), { amount: fmtEur(moreAmount) })}
              </Text>
            ) : null}
            <Pressable
              onPress={() => router.push('/plano')}
              style={({ pressed }) => ({
                marginTop: 13,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: t0.rs,
                backgroundColor: t0.card2,
                borderWidth: 1,
                borderColor: t0.b,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx }}>{t('leak_cta')} →</Text>
            </Pressable>
          </Card>
        ) : fs.monthDeficit > 0 ? null : (
          // "Não perdeste dinheiro" seria falso num mês em défice.
          <Card t={t0} style={{ marginBottom: 12, borderLeftWidth: 3, borderLeftColor: t0.gr, alignItems: 'center' }}>
            <CheckIcon color={t0.tx} />
            <Text style={{ fontSize: 14, fontWeight: '900', color: t0.tx, marginTop: 8, marginBottom: 4 }}>
              {t('leak_none_title')}
            </Text>
            <Text style={{ fontSize: 12, color: t0.tx2, textAlign: 'center' }}>{t('leak_none_sub')}</Text>
          </Card>
        )}

        {/* Entradas e saídas */}
        <Card t={t0} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: t0.tx2, letterSpacing: 0.8 }}>{t('cf_lbl')}</Text>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: t0.pr,
                backgroundColor: alpha(t0.pr, 15),
                borderWidth: 1,
                borderColor: alpha(t0.pr, 25),
                borderRadius: 20,
                paddingHorizontal: 9,
                paddingVertical: 2,
                overflow: 'hidden',
              }}
            >
              {currMonth}
            </Text>
          </View>

          {snap.balanceSet && fs.currentBalance !== null ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ fontSize: 11, color: t0.tx2, letterSpacing: 0.8 }}>{t('bal_current')}</Text>
                <Pressable
                  onPress={() => {
                    setBalanceInput(fs.currentBalance !== null ? String(fs.currentBalance) : '');
                    setEditingBalance(true);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: t0.tx3 }}>{t('bal_edit')}</Text>
                </Pressable>
              </View>
              <Text style={{ fontSize: 30, fontWeight: '900', color: t0.tx, letterSpacing: -1, marginBottom: 11 }}>
                {fmtEur(fs.currentBalance)}
              </Text>
              {/* A conta tem de fechar no ecrã: saldo − por pagar − reservado = livre. */}
              <View style={{ flexDirection: 'row', gap: 14, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: t0.tx2 }}>{t('bal_unpaid')}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: t0.re, marginTop: 1 }}>
                    −{fmtEur(fs.unpaidExpensesThisMonth)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: t0.tx2 }}>{t('goals_reserved')}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx2, marginTop: 1 }}>
                    −{fmtEur(fs.allocatedTotal)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: t0.tx2 }}>{t('goals_free')}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx, marginTop: 1 }}>{fmtEur(spendable)}</Text>
                </View>
              </View>

              {/* As subscrições saem da conta todos os meses e não estão nas
                  despesas registadas — o "livre" conta-as como disponível. Não
                  se descontam à força: a app não sabe o dia da cobrança e o
                  saldo copiado do banco pode já as excluir. */}
              {subsDue.total > 0 ? (
                <View
                  style={{
                    marginBottom: 10,
                    padding: 12,
                    borderRadius: t0.rs,
                    backgroundColor: alpha(t0.ye, 10),
                    borderWidth: 1,
                    borderColor: alpha(t0.ye, 28),
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx, marginBottom: 3 }}>
                    {t('subs_due_title')}
                  </Text>
                  <Text style={{ fontSize: 11, color: t0.tx2, lineHeight: 17 }}>
                    {fill(t('subs_due_sub'), {
                      n: subsDue.items.length,
                      amount: fmtEur(subsDue.total),
                      after: fmtEur(Math.round((spendable - subsDue.total) * 100) / 100),
                    })}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginVertical: 8 }}>
                    {subsDue.items.map((s) => (
                      <Text
                        key={s.name}
                        style={{
                          fontSize: 10.5,
                          fontWeight: '700',
                          color: t0.tx2,
                          backgroundColor: t0.card2,
                          borderWidth: 1,
                          borderColor: t0.b,
                          borderRadius: 20,
                          paddingHorizontal: 9,
                          paddingVertical: 3,
                          overflow: 'hidden',
                        }}
                      >
                        {s.name} · {fmtEur(s.price)}
                      </Text>
                    ))}
                  </View>
                  <Pressable
                    onPress={() => void addSubsToList()}
                    disabled={addingSubs}
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: t0.tx,
                      borderRadius: 20,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      opacity: addingSubs ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#fff' }}>{t('subs_due_cta')}</Text>
                  </Pressable>
                  <Text style={{ fontSize: 10.5, color: t0.tx3, lineHeight: 15, marginTop: 7 }}>{t('subs_due_note')}</Text>
                </View>
              ) : null}
            </>
          ) : snap.manual.length === 0 ? (
            <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 19, marginBottom: 6 }}>
              {fill(t('cf_empty_manual'), { month: currMonth })}
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: 30, fontWeight: '900', color: t0.tx, letterSpacing: -1, marginBottom: 11 }}>
                {fmtEur(fs.manualNet)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 14, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: t0.tx2 }}>{t('chart_income')}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: t0.gr, marginTop: 1 }}>
                    +{fmtEur(fs.manualIncomeThisMonth)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: t0.tx2 }}>{t('chart_expenses')}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: t0.re, marginTop: 1 }}>
                    −{fmtEur(fs.manualExpensesThisMonth)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: t0.tx2 }}>{t('goals_reserved')}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx2, marginTop: 1 }}>
                    −{fmtEur(fs.allocatedTotal)}
                  </Text>
                </View>
              </View>
            </>
          )}

          <Text style={{ fontSize: 12, color: t0.tx3 }}>
            {fill(t('cf_last_month'), { month: pastMonth })}{' '}
            <Text style={{ fontWeight: '800', color: fs.net >= 0 ? t0.gr : t0.tx }}>
              {fs.net >= 0 ? '+' : ''}
              {fmtEur(fs.net)}
            </Text>
          </Text>

          <CashflowChart
            points={chartPoints}
            t={t0}
            width={chartWidth}
            labels={{ net: t('chart_net'), income: t('chart_income'), expenses: t('chart_expenses') }}
          />
          {chartPoints.length > 0 ? (
            <ChartLegend
              t={t0}
              labels={{ net: t('chart_net'), income: t('chart_income'), expenses: t('chart_expenses') }}
            />
          ) : null}
        </Card>

        {/* Quanto podes gastar */}
        <Card t={t0} style={{ marginBottom: 12, borderColor: alpha(t0.pr, 40) }}>
          <Text style={{ fontSize: 11, color: t0.pr, fontWeight: '800', letterSpacing: 0.6, marginBottom: 10 }}>
            {t('spend_lbl')} · {currMonth}
          </Text>

          {!snap.balanceSet || editingBalance ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: '900', color: t0.tx, marginBottom: 4 }}>{t('bal_set_title')}</Text>
              <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18, marginBottom: 12 }}>{t('bal_set_sub')}</Text>

              {/* Quem acerta o saldo está a copiar um número do banco. Se tinha
                  despesas apontadas por pagar, esse número já pode incluir
                  algumas — e a app não tem como saber quais. */}
              {editingBalance && unpaidRows.length > 0 ? (
                <View style={{ marginBottom: 12, padding: 12, borderRadius: t0.rs, backgroundColor: t0.card2 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx, marginBottom: 2 }}>
                    {t('bal_confirm_title')}
                  </Text>
                  <Text style={{ fontSize: 11, color: t0.tx2, lineHeight: 16, marginBottom: 9 }}>
                    {t('bal_confirm_sub')}
                  </Text>
                  {unpaidRows.map((m) => {
                    const on = paidNow.includes(m.id);
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setPaidNow(on ? paidNow.filter((x) => x !== m.id) : [...paidNow, m.id])}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 9,
                          paddingHorizontal: 10,
                          paddingVertical: 9,
                          marginBottom: 5,
                          borderRadius: t0.rs,
                          borderWidth: 1,
                          borderColor: on ? t0.tx : t0.b,
                          backgroundColor: t0.card,
                        }}
                      >
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            borderWidth: on ? 0 : 1.5,
                            borderColor: t0.tx3,
                            backgroundColor: on ? t0.tx : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {on ? <CheckIcon color={t0.bg} size={12} /> : null}
                        </View>
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '700', color: t0.tx }}>
                          {m.note || catLabel(m.category)}
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx2 }}>
                          −{fmtEur(Number(m.amount))}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <MoneyInput
                  value={balanceInput}
                  onChangeText={setBalanceInput}
                  placeholder={t('bal_placeholder')}
                  onSubmit={() => void saveBalance()}
                />
                <Pressable
                  onPress={() => void saveBalance()}
                  style={{ justifyContent: 'center', paddingHorizontal: 18, borderRadius: t0.rs, backgroundColor: t0.pr }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{t('bal_set_cta')}</Text>
                </Pressable>
              </View>
              {editingBalance ? (
                <Pressable
                  onPress={() => {
                    setEditingBalance(false);
                    setPaidNow([]);
                  }}
                  hitSlop={6}
                  style={{ marginTop: 12 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx2 }}>{t('goal_cancel')}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              {/* Sem repetir o saldo: este cartão responde só a "a que ritmo
                  posso gastar", que é uma pergunta diferente. */}
              <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18, marginBottom: 12 }}>
                {fill(t('spend_frame_real'), { spendable: fmtEur(spendable), days })}
              </Text>
              <Text style={{ fontSize: 30, fontWeight: '900', color: t0.pr, letterSpacing: -1 }}>
                ~{fmtEur(nowW)}
                <Text style={{ fontSize: 14, fontWeight: '800' }}>{t('pace_week')}</Text>
              </Text>
              <Text style={{ fontSize: 13, color: t0.tx2, marginTop: 2 }}>
                {fill(t('pace_day'), { amount: fmtEur(nowW / 7) })}
              </Text>

              {optSavings > 0.5 ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      alignItems: 'flex-start',
                      marginTop: 13,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: t0.rs,
                      backgroundColor: t0.card2,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t0.tx3, marginTop: 4 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: t0.tx, marginBottom: 2 }}>
                        {t('spend_plan_title')}
                      </Text>
                      <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 17 }}>
                        {fill(t('spend_plan_line'), { amount: fmtEur(planKeep) })}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => router.push('/plano')}
                    style={({ pressed }) => ({
                      marginTop: 11,
                      paddingVertical: 11,
                      alignItems: 'center',
                      borderRadius: t0.rs,
                      backgroundColor: t0.card2,
                      borderWidth: 1,
                      borderColor: t0.b,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx }}>{t('spend_cut_cta')}</Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                onPress={() => setShowHow((v) => !v)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13 }}
                hitSlop={6}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: t0.tx2 }}>{t('spend_how')}</Text>
                <Text style={{ fontSize: 11, color: t0.tx2 }}>{showHow ? '▴' : '▾'}</Text>
              </Pressable>
              {showHow ? (
                <View style={{ marginTop: 10, padding: 12, backgroundColor: t0.card2, borderRadius: t0.rs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                    <Text style={{ fontSize: 12, color: t0.tx2 }}>{t('spend_row_balance')}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx }}>{fmtEur(fs.currentBalance ?? 0)}</Text>
                  </View>
                  {fs.allocatedTotal > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                      <Text style={{ fontSize: 12, color: t0.tx2 }}>{t('spend_row_reserved')}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx }}>−{fmtEur(fs.allocatedTotal)}</Text>
                    </View>
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      borderTopWidth: 1,
                      borderTopColor: t0.b,
                      marginTop: 5,
                      paddingTop: 7,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx }}>{t('spend_row_spendable')}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx }}>{fmtEur(spendable)}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: t0.tx3, marginTop: 6 }}>
                    {fill(t('spend_row_days'), { n: days })}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </Card>

        {/* Próxima meta */}
        <Card t={t0}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: t0.tx3, letterSpacing: 0.7 }}>
              {t('next_goal_lbl')}
            </Text>
            <Pressable onPress={() => router.push('/metas')} hitSlop={8}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: t0.pr }}>{t('next_goal_cta')}</Text>
            </Pressable>
          </View>
          {nextGoal ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ paddingTop: 2 }}>
                <GoalIcon name={nextGoal.name} color={t0.pr} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '900', color: t0.tx }}>
                    {nextGoal.name}
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: t0.pr }}>{goalPct}%</Text>
                </View>
                <View style={{ height: 5, backgroundColor: t0.b, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${goalPct}%`, backgroundColor: t0.pr, borderRadius: 3 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ fontSize: 12, color: t0.tx2 }}>
                    {fmtEur(Number(nextGoal.current_eur))} / {fmtEur(Number(nextGoal.target_eur))}
                  </Text>
                  <Text style={{ fontSize: 12, color: t0.tx2 }}>{goalDate}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: t0.tx, marginTop: 8 }}>
                  {fill(t('goal_remaining'), {
                    amount: fmtEur(Number(nextGoal.target_eur) - Number(nextGoal.current_eur)),
                  })}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: t0.tx2 }}>{t('next_goal_none')}</Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
