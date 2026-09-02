// Análise — a mesma vista da web: resumo das subscrições, limites por
// categoria (escondidos atrás de um toque) e a lista de insights do motor,
// com "ver mais" a partir dos cinco primeiros.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../../src/Text';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { insightText, insightTitle, orderInsights, type DictKey } from '@optifi/core';
import { useFinance } from '../../src/lib/finance';
import { useI18n } from '../../src/lib/i18n';
import { useTheme } from '../../src/lib/theme-context';
import { fill, fmtEur, fmtEur0, monthLabel } from '@optifi/core';
import { alpha, Button, Card, Screen } from '../../src/ui';

const S = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// Limpeza à Revolut: cor SÓ na semântica de dinheiro. Alertas e conquistas são
// neutros — o ícone diz o tipo, a cor não precisa de gritar.
function KindIcon({ kind, color }: { kind: string; color: string }) {
  const paths: Record<string, React.ReactNode> = {
    leak: <Path d="M12 3v14M6 11l6 6 6-6" stroke={color} {...S} />,
    alert: (
      <>
        <Path d="M12 9v4M12 17h.01" stroke={color} {...S} />
        <Path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" stroke={color} {...S} />
      </>
    ),
    savings: (
      <>
        <Circle cx="12" cy="12" r="9" stroke={color} {...S} />
        <Path d="M12 17V7M8.5 10.5 12 7l3.5 3.5" stroke={color} {...S} />
      </>
    ),
    achievement: (
      <>
        <Path d="M8 21h8M12 17v4M6 3h12v6a6 6 0 0 1-12 0V3Z" stroke={color} {...S} />
        <Path d="M6 5H3v2a4 4 0 0 0 3 3.87M18 5h3v2a4 4 0 0 1-3 3.87" stroke={color} {...S} />
      </>
    ),
  };
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      {paths[kind] ?? paths.alert}
    </Svg>
  );
}

/** O `<details class="invest-more">` da web. */
function InvestMore({ text }: { text: string }) {
  const t0 = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 7 }}>
      <Pressable onPress={() => setOpen((v) => !v)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path d="M3 17 9 11l4 4 8-8" stroke={t0.tx3} {...S} />
          <Path d="M14 7h7v7" stroke={t0.tx3} {...S} />
        </Svg>
        <Text style={{ fontSize: 11, fontWeight: '700', color: t0.tx3 }}>{t('ins_invest_toggle')}</Text>
        <Text style={{ fontSize: 11, color: t0.tx3 }}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? <Text style={{ fontSize: 11, color: t0.tx2, lineHeight: 17, marginTop: 6 }}>{text}</Text> : null}
    </View>
  );
}

// Categorias que o utilizador pode limitar (todas as de despesa). A lista vive
// escondida atrás de um toque — ele decide o que quer controlar.
const LIMITABLE_CATS = ['habitacao', 'alimentacao', 'transporte', 'saude', 'educacao', 'lazer', 'subscricoes', 'transferencias', 'outros'];

function LimitRow({
  categoryId,
  spent,
  lastMonth,
  limit,
  state,
  onSet,
  onClear,
  last,
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
  last?: boolean;
}) {
  const t0 = useTheme();
  const { t } = useI18n();
  const [val, setVal] = useState(limit !== undefined ? String(limit) : '');
  const chip = state
    ? state.state === 'ok'
      ? { txt: t('limits_state_ok'), color: t0.tx2 }
      : state.state === 'tight'
        ? { txt: t('limits_state_tight'), color: t0.tx2 }
        : { txt: fill(t('limits_state_over'), { amount: fmtEur(state.overBy) }), color: t0.tx }
    : null;
  return (
    <View style={{ paddingVertical: 9, borderBottomWidth: last ? 0 : 1, borderBottomColor: t0.b }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: t0.tx }}>
          {t(`cat_${categoryId}` as DictKey)}
          {chip ? <Text style={{ fontSize: 10, fontWeight: '800', color: chip.color }}>{`   ${chip.txt}`}</Text> : null}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: t0.tx2 }}>{fill(t('limits_spent'), { amount: fmtEur(spent) })}</Text>
          <Text style={{ fontSize: 10, color: t0.tx3 }}>{fill(t('limits_ref'), { amount: fmtEur(lastMonth) })}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={val}
          onChangeText={setVal}
          keyboardType="decimal-pad"
          placeholder={t('limits_placeholder')}
          placeholderTextColor={t0.tx3}
          style={{
            width: 110,
            paddingVertical: 8,
            paddingHorizontal: 10,
            fontSize: 12,
            color: t0.tx,
            backgroundColor: t0.card2,
            borderWidth: 1,
            borderColor: t0.b,
            borderRadius: t0.rs,
          }}
        />
        <Pressable
          onPress={() => {
            const v = parseFloat(val.replace(',', '.'));
            if (v >= 0) onSet(v);
          }}
          style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: t0.rs, borderWidth: 1, borderColor: t0.b, backgroundColor: t0.card2 }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: t0.pr }}>{t('limits_set')}</Text>
        </Pressable>
        {limit !== undefined ? (
          <Pressable
            onPress={() => {
              setVal('');
              onClear();
            }}
            style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: t0.rs, borderWidth: 1, borderColor: t0.b, backgroundColor: t0.card2 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: t0.tx3 }}>{t('limits_clear')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function Analise() {
  const t0 = useTheme();
  const router = useRouter();
  const fin = useFinance();
  const { fin: snap, loading, reload } = fin;
  const { t } = useI18n();

  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showLimits, setShowLimits] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  if (loading || !snap) {
    return (
      <Screen t={t0}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t0.pr} />
        </View>
      </Screen>
    );
  }

  const title = (
    <Text style={{ fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5, marginBottom: 14 }}>{t('nav_insights')}</Text>
  );

  const { imp, fs, analysis, smart, subs, categorySpend, limits } = snap;
  if (!imp || !fs || !analysis) {
    return (
      <Screen t={t0}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13, paddingBottom: 28 }}>
          {title}
          <Card t={t0} style={{ marginBottom: 11 }}>
            <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 19 }}>{t('empty_insights')}</Text>
          </Card>
          <Button t={t0} label={t('wiz_title')} onPress={() => router.push('/importar')} />
        </ScrollView>
      </Screen>
    );
  }

  const catLabel = (id: string) => t(`cat_${id}` as DictKey);
  /** O mês a que os números da análise pertencem — o do extrato, não o de hoje. */
  const statementMonth = monthLabel(imp.statement_month);

  const ordered = orderInsights(smart, analysis.insights);
  const PRIMARY = 5;
  const deps = { t, catLabel, fmtEur, fmtEur0, fill, statementMonth };
  const visible = showAll ? ordered : ordered.slice(0, PRIMARY);
  const hidden = ordered.length - visible.length;

  return (
    <Screen t={t0}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={t0.pr} />}
        keyboardShouldPersistTaps="handled"
      >
        {title}

        {/* Plano de poupança — na web abre-se do Início; aqui está nos dois. */}
        {analysis.planItems.length > 0 ? (
          <Pressable onPress={() => router.push('/plano')}>
            <Card t={t0} style={{ marginBottom: 12, borderLeftWidth: 3, borderLeftColor: t0.tx }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: t0.tx, marginBottom: 2 }}>{t('pd_title')}</Text>
                  <Text style={{ fontSize: 12, color: t0.tx2 }}>
                    {fill(t('pd_annual_val'), { amount: fmtEur0(analysis.baseLeak * 12) })}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: t0.pr }}>{`${fmtEur0(analysis.baseLeak)}/mês →`}</Text>
              </View>
            </Card>
          </Pressable>
        ) : null}

        {/* Subscrições — resumo */}
        <Card t={t0} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: t0.tx, marginBottom: 2 }}>{t('subs_title')}</Text>
              <Text style={{ fontSize: 12, color: t0.tx2 }}>
                {fill(t('subs_active_total'), {
                  n: subs.filter((s) => s.user_status !== 'cancelled').length,
                  amount: fmtEur(fs.subsTotal),
                })}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/atividade')} hitSlop={6}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: t0.pr }}>{t('subs_review_cta')} →</Text>
            </Pressable>
          </View>
        </Card>

        {/* Limites por categoria */}
        <Card t={t0} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: t0.tx, marginBottom: 4 }}>{t('limits_title')}</Text>
          <Text style={{ fontSize: 11, color: t0.tx3, marginBottom: 6 }}>
            {fill(t('limits_sub'), { month: monthLabel(snap.planMonth) })}
          </Text>
          {fs.limitsSavingsPotential > 0 ? (
            <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx, marginBottom: 4 }}>
              {fill(t('limits_potential'), { amount: fmtEur(fs.limitsSavingsPotential) })}
            </Text>
          ) : null}
          <Pressable onPress={() => setShowLimits((v) => !v)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M12 5v14M5 12h14" stroke={t0.tx2} fill="none" strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: t0.tx2 }}>{t('limits_toggle')}</Text>
            <Text style={{ fontSize: 12, color: t0.tx2 }}>{showLimits ? '▴' : '▾'}</Text>
          </Pressable>
          {showLimits ? (
            <View>
              {LIMITABLE_CATS.map((cat, i) => (
                <LimitRow
                  key={cat}
                  categoryId={cat}
                  spent={fs.manualCategorySpend.find((m) => m.categoryId === cat)?.amount ?? 0}
                  lastMonth={categorySpend.find((c) => c.categoryId === cat)?.amount ?? 0}
                  limit={limits[cat]}
                  state={fs.categoryLimitStates[cat]}
                  onSet={(eur) => void fin.setLimit(cat, eur)}
                  onClear={() => void fin.clearLimit(cat)}
                  last={i === LIMITABLE_CATS.length - 1}
                />
              ))}
            </View>
          ) : null}
        </Card>

        {/* Insights: do motor + os informativos da análise base */}
        {visible.map((ins) => {
          const isSubPrice = ins.id.startsWith('sub_save_') || ins.id.startsWith('sub_free_');
          return (
            <Card key={ins.id} t={t0} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t0.card2 }}>
                  <KindIcon kind={ins.kind} color={t0.tx2} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: t0.tx }}>{insightTitle(ins, { t, catLabel })}</Text>
                    {ins.saving > 0 ? (
                      <Text style={{ fontSize: 11, fontWeight: '800', color: t0.gr }}>+{fmtEur(ins.saving)}/mês</Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18, marginTop: 4 }}>{insightText(ins, deps)}</Text>
                  {ins.params.fv10 !== undefined ? (
                    <InvestMore
                      text={fill(t('ins_invest_multi'), {
                        monthly: fmtEur(Number(ins.params.monthly)),
                        rate: ins.params.rate!,
                        fv10: fmtEur0(Number(ins.params.fv10)),
                        fv15: fmtEur0(Number(ins.params.fv15)),
                        fv20: fmtEur0(Number(ins.params.fv20)),
                      })}
                    />
                  ) : null}
                  {isSubPrice ? <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 6 }}>{t('ins_prices_note')}</Text> : null}
                </View>
              </View>
            </Card>
          );
        })}

        {(hidden > 0 || showAll) && ordered.length > PRIMARY ? (
          <Pressable
            onPress={() => setShowAll((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 12,
              borderRadius: t0.rs,
              borderWidth: 1,
              borderColor: t0.b,
              backgroundColor: alpha(t0.tx2, 5),
            }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: t0.tx2 }}>
              {showAll ? t('ins_see_less') : fill(t('ins_see_more'), { n: hidden })}
            </Text>
            <Text style={{ fontSize: 12, color: t0.tx2 }}>{showAll ? '▴' : '▾'}</Text>
          </Pressable>
        ) : null}

        {smart.length === 0 && analysis.insights.length === 0 ? (
          <Card t={t0}>
            <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18 }}>{fill(t('ins_empty'), { month: statementMonth })}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
