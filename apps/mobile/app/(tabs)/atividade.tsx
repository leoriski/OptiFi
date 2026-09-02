// Atividade — a mesma vista da web: banner do extrato importado, separadores
// Movimentos/Subscrições, movimentos manuais do mês corrente SEPARADOS do mês
// importado, filtros por categoria e recategorização por comerciante.
//
// A única diferença deliberada para a web é o assistente de importação, que
// aqui vive no seu próprio ecrã (`/importar`) — num telemóvel o seletor de
// ficheiros é do sistema e abrir um ecrã inteiro é o gesto natural.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { Text, TextInput } from '../../src/Text';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { prettyMerchant, type CategoryKey, type DictKey } from '@optifi/core';
import { useFinance } from '../../src/lib/finance';
import { useI18n } from '../../src/lib/i18n';
import { dayShort, dayShortFromIso, fill, fmtEur, monthLabel } from '@optifi/core';
import { alpha, Card, Screen, SectionLabel } from '../../src/ui';
import { CategoryIcon } from '../../src/CategoryIcon';
import { CheckIcon } from '../../src/icons';
import { useTheme } from '../../src/lib/theme-context';


const FILTER_ORDER: CategoryKey[] = ['habitacao', 'alimentacao', 'transporte', 'lazer', 'subscricoes', 'saude', 'educacao', 'transferencias', 'receita', 'outros'];
const MANUAL_CATS: CategoryKey[] = ['habitacao', 'alimentacao', 'transporte', 'lazer', 'subscricoes', 'saude', 'educacao', 'transferencias', 'outros'];

/** O `.tx-cat-icon`: chip neutro, 31×31. A cor semântica vive nos valores. */
function CatChip({ category }: { category: string }) {
  const t0 = useTheme();
  return (
    <View
      style={{
        width: 31,
        height: 31,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: alpha(t0.tx2, 16),
      }}
    >
      <CategoryIcon category={category} color={t0.tx2} size={15} />
    </View>
  );
}

/** Caixa de seleção larga usada nas opções do registo manual. */
function CheckRow({ on, label, right, onToggle }: { on: boolean; label: string; right?: string; onToggle: () => void }) {
  const t0 = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
        borderRadius: t0.rs,
        borderWidth: 1,
        borderColor: on ? t0.tx : t0.b,
        backgroundColor: t0.card2,
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
      <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: t0.tx }}>{label}</Text>
      {right ? <Text style={{ fontSize: 12, fontWeight: '800', color: t0.tx2 }}>{right}</Text> : null}
    </Pressable>
  );
}

/** O `.cat-pill`. Sem `<select>` no nativo, escolher categoria é isto. */
function CatPill({ label, on, category, onPress }: { label: string; on: boolean; category?: CategoryKey; onPress: () => void }) {
  const t0 = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: on ? t0.pr : t0.b,
        backgroundColor: on ? t0.pr : t0.card,
      }}
    >
      {category ? <CategoryIcon category={category} color={on ? '#fff' : t0.tx2} size={12} /> : null}
      <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : t0.tx2 }}>{label}</Text>
    </Pressable>
  );
}

/** O `.auth-input` do protótipo. */
function Input({ value, onChangeText, placeholder, numeric, style }: { value: string; onChangeText: (v: string) => void; placeholder: string; numeric?: boolean; style?: ViewStyle }) {
  const t0 = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t0.tx3}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      style={[
        {
          backgroundColor: t0.card2,
          borderColor: t0.b,
          borderWidth: 1,
          borderRadius: t0.rs,
          paddingHorizontal: 12,
          paddingVertical: 11,
          fontSize: 14,
          color: t0.tx,
        },
        style,
      ]}
    />
  );
}

/** O `×` que apaga uma linha. */
function RemoveBtn({ onPress, label }: { onPress: () => void; label: string }) {
  const t0 = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={{ padding: 4 }}>
      <Text style={{ fontSize: 17, color: t0.tx3, lineHeight: 19 }}>×</Text>
    </Pressable>
  );
}

export default function Atividade() {
  const t0 = useTheme();
  const router = useRouter();
  const fin = useFinance();
  const { fin: snap, loading, reload } = fin;
  const { t } = useI18n();

  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'mov' | 'subs'>('mov');
  const [filter, setFilter] = useState<'all' | CategoryKey>('all');
  // Comerciante com o seletor de categoria aberto (o nome mostrado, não o id
  // da linha: a regra é por comerciante).
  const [catFor, setCatFor] = useState<string | null>(null);

  // Movimento manual
  const [showManualForm, setShowManualForm] = useState(false);
  const [mType, setMType] = useState<'expense' | 'income'>('expense');
  const [mAmount, setMAmount] = useState('');
  const [mCat, setMCat] = useState<CategoryKey>('outros');
  const [mNote, setMNote] = useState('');
  const [mMealCard, setMMealCard] = useState(false);
  // Por omissão a despesa fica POR PAGAR: o gesto normal é receber o salário e
  // apontar o que há a pagar. Quem regista algo já pago liga este toggle.
  const [mPaid, setMPaid] = useState(false);

  // Subscrição manual
  const [showSubForm, setShowSubForm] = useState(false);
  const [sName, setSName] = useState('');
  const [sPrice, setSPrice] = useState('');

  // Re-análise dos extratos já importados com as regras atuais
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeMsg, setReanalyzeMsg] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  async function reanalyze() {
    setReanalyzing(true);
    setReanalyzeMsg('');
    try {
      const changed = await fin.reanalyze();
      setReanalyzeMsg(changed === 0 ? t('act_reanalyze_none') : fill(t('act_reanalyze_done'), { n: changed }));
    } catch {
      setReanalyzeMsg(t('act_reanalyze_error'));
    }
    setReanalyzing(false);
  }

  async function addManualEntry() {
    const amount = parseFloat(mAmount.replace(',', '.'));
    if (!(amount > 0)) return;
    await fin.addManual({
      type: mType,
      amount,
      category: mType === 'income' ? 'receita' : mCat,
      note: mNote,
      mealCard: mType === 'expense' && mMealCard,
      paid: mPaid,
    });
    setMAmount('');
    setMNote('');
    setMMealCard(false);
    setMPaid(false);
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

  if (loading || !snap) {
    return (
      <Screen t={t0}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t0.pr} />
        </View>
      </Screen>
    );
  }

  const header = (
    <View style={{ marginBottom: 13 }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5, marginBottom: 2 }}>
        {t('nav_activity')}
      </Text>
      <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 17 }}>{t('act_page_sub')}</Text>
    </View>
  );

  // Primeiro arranque (ainda sem importação): cabeçalho de boas-vindas em vez
  // do genérico "Atividade" — para quem chega, isto é a configuração inicial.
  const welcomeHeader = (
    <View style={{ marginBottom: 13 }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5, marginBottom: 2 }}>
        {t('onb_welcome_title')}
      </Text>
      <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 17 }}>{t('onb_welcome_sub')}</Text>
    </View>
  );

  // ── Ainda sem importação ──
  if (!snap.imp) {
    return (
      <Screen t={t0}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13, paddingBottom: 28 }}>
          {welcomeHeader}
          <Card t={t0} style={{ marginBottom: 11 }}>
            <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 19 }}>{t('empty_activity')}</Text>
          </Card>
          <Pressable
            onPress={() => router.push('/importar')}
            style={{
              paddingVertical: 14,
              alignItems: 'center',
              borderRadius: t0.r,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: alpha(t0.pr, 45),
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: t0.pr }}>{t('wiz_title')}</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  // ── Vista normal ──
  const { txs, subs, manual } = snap;
  const pastMonth = monthLabel(snap.imp.statement_month);
  const currMonth = monthLabel(snap.planMonth);
  const presentCats = FILTER_ORDER.filter((c) => txs.some((tx) => tx.category === c));
  const filteredTxs = filter === 'all' ? txs : txs.filter((tx) => tx.category === filter);
  // Quantas linhas cada comerciante tem: é o que a app promete arrumar de uma
  // vez quando o utilizador escolhe a categoria, e dizer o número evita a
  // surpresa de ver duas linhas mudarem depois de tocar numa.
  const merchantCount = new Map<string, number>();
  for (const tx of txs) {
    const k = prettyMerchant(tx.description);
    merchantCount.set(k, (merchantCount.get(k) ?? 0) + 1);
  }
  const unknownCount = txs.filter((tx) => tx.category === 'outros').length;
  const activeSubs = subs.filter((s) => s.user_status !== 'cancelled');
  const subsTotal = activeSubs.reduce((a, b) => a + Number(b.price), 0);
  const catLabel = (c: string) => t(`cat_${c}` as DictKey);

  const tabPill = (id: 'mov' | 'subs', label: string) => {
    const on = tab === id;
    return (
      <Pressable
        onPress={() => setTab(id)}
        style={{ flex: 1, paddingVertical: 11, borderRadius: t0.rs, alignItems: 'center', backgroundColor: on ? t0.pr : 'transparent' }}
      >
        <Text style={{ fontSize: 13, fontWeight: '800', color: on ? '#fff' : t0.tx2 }}>{label}</Text>
      </Pressable>
    );
  };

  const verdictBtn = (label: string, color: string, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderRadius: t0.rs,
        borderWidth: 1,
        borderColor: alpha(color, 35),
        backgroundColor: t0.card2,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color }}>{label}</Text>
    </Pressable>
  );

  const txRowStyle: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 };

  return (
    <Screen t={t0}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t0.pr} />}
        keyboardShouldPersistTaps="handled"
      >
        {header}

        {/* Banner: extrato importado + re-analisar + re-importar */}
        <Card t={t0} style={{ marginBottom: 11, paddingVertical: 13, paddingHorizontal: 15 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: t0.tx2 }}>{t('act_imported_banner')}</Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={() => void reanalyze()} disabled={reanalyzing} hitSlop={6}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx2, textDecorationLine: 'underline', opacity: reanalyzing ? 0.6 : 1 }}>
                  {reanalyzing ? t('act_reanalyze_busy') : t('act_reanalyze_link')}
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push('/importar')} hitSlop={6}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx2, textDecorationLine: 'underline' }}>
                  {t('act_reimport_link')}
                </Text>
              </Pressable>
            </View>
          </View>
          {reanalyzeMsg ? <Text style={{ fontSize: 12, color: t0.tx2, marginTop: 8 }}>{reanalyzeMsg}</Text> : null}
        </Card>

        {/* Separadores Movimentos | Subscrições */}
        <Card t={t0} style={{ marginBottom: 11, padding: 5 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {tabPill('mov', t('act_tab_movements'))}
            {tabPill('subs', t('act_tab_subs'))}
          </View>
        </Card>

        {tab === 'mov' ? (
          <>
            {/* Adicionar movimento manual */}
            {showManualForm ? (
              <Card t={t0} style={{ marginBottom: 11 }}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  {(['expense', 'income'] as const).map((ty) => {
                    const on = mType === ty;
                    return (
                      <Pressable
                        key={ty}
                        onPress={() => setMType(ty)}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: t0.rs,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: on ? t0.pr : t0.b,
                          backgroundColor: on ? t0.pr : t0.card2,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: on ? '#fff' : t0.tx2 }}>
                          {ty === 'expense' ? t('manual_type_expense') : t('manual_type_income')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Input value={mAmount} onChangeText={setMAmount} placeholder={t('manual_amount')} numeric style={{ marginBottom: 8 }} />

                {mType === 'expense' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingBottom: 4 }} style={{ marginBottom: 8 }}>
                    {MANUAL_CATS.map((c) => (
                      <CatPill key={c} label={catLabel(c)} category={c} on={mCat === c} onPress={() => setMCat(c)} />
                    ))}
                  </ScrollView>
                ) : null}

                <Input value={mNote} onChangeText={setMNote} placeholder={t('manual_note')} style={{ marginBottom: 10 }} />

                {mType === 'expense' && snap.mealCard > 0 ? (
                  <CheckRow
                    on={mMealCard}
                    onToggle={() => setMMealCard(!mMealCard)}
                    label={t('manual_meal_toggle')}
                    /* Quanto ainda resta no cartão, aqui mesmo: é neste momento
                       que a pergunta se faz. */
                    right={snap.fs?.mealCard ? `${t('meal_home_left')} ${fmtEur(snap.fs.mealCard.left)}` : undefined}
                  />
                ) : null}

                {/* Uma despesa do cartão refeição sai na hora — não há estado
                    por pagar para perguntar. Nas outras, a app não pode
                    adivinhar: só o utilizador sabe se o dinheiro já saiu. */}
                {mType === 'expense' && !mMealCard ? (
                  <CheckRow on={mPaid} onToggle={() => setMPaid(!mPaid)} label={t('manual_paid_toggle')} />
                ) : null}

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => void addManualEntry()}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: t0.rs, alignItems: 'center', backgroundColor: t0.pr }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{t('manual_save')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowManualForm(false)}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: t0.rs, alignItems: 'center', backgroundColor: t0.card2, borderWidth: 1, borderColor: t0.b }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx }}>{t('goal_cancel')}</Text>
                  </Pressable>
                </View>
              </Card>
            ) : (
              <Pressable
                onPress={() => setShowManualForm(true)}
                style={{
                  paddingVertical: 14,
                  marginBottom: 11,
                  alignItems: 'center',
                  borderRadius: t0.r,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: alpha(t0.pr, 45),
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: t0.pr }}>{t('act_add_manual')}</Text>
              </Pressable>
            )}

            {/* Mês corrente (manual) — nunca misturado com o importado.
                O saldo de abertura (âncora) aparece aqui como ponto de partida. */}
            {manual.length > 0 || snap.openingBalance ? (
              <>
                <SectionLabel t={t0}>{fill(t('act_sec_manual'), { month: currMonth })}</SectionLabel>
                <Card t={t0} style={{ marginBottom: 11 }}>
                  {snap.openingBalance ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        padding: 10,
                        marginBottom: 2,
                        borderRadius: t0.rs,
                        backgroundColor: alpha(t0.gr, 7),
                      }}
                    >
                      <View style={{ width: 31, height: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t0.gr, 16) }}>
                        <Svg viewBox="0 0 24 24" width={15} height={15}>
                          <Path d="M12 5v14M5 12l7-7 7 7" fill="none" stroke={t0.gr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: t0.tx }}>{t('bal_opening')}</Text>
                        <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 1 }}>
                          {fill(t('bal_opening_sub'), { date: dayShortFromIso(snap.openingBalance.at) })}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: t0.gr }}>+{fmtEur(snap.openingBalance.amount)}</Text>
                      <RemoveBtn onPress={() => void fin.clearBalance()} label={t('manual_delete')} />
                    </View>
                  ) : null}

                  {manual.map((m, i) => (
                    <View
                      key={m.id}
                      style={[txRowStyle, { borderBottomWidth: i === manual.length - 1 ? 0 : 1, borderBottomColor: t0.b }]}
                    >
                      <CatChip category={m.category} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: t0.tx }}>
                          {m.note || catLabel(m.category)}
                        </Text>
                        <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 1 }}>
                          {catLabel(m.category)}
                          {m.meal_card ? ` · ${t('meal_card_title')}` : ''}
                        </Text>
                        {/* O estado por pagar muda-se aqui, num toque, sem abrir
                            nada: é a mesma linha onde se vê a despesa. Só para
                            despesas da conta — as do cartão já saíram. */}
                        {m.entry_type === 'expense' && !m.meal_card ? (
                          <Pressable
                            onPress={() => void fin.setManualPaid(m.id, !m.paid_at)}
                            hitSlop={6}
                            style={{
                              alignSelf: 'flex-start',
                              marginTop: 3,
                              paddingVertical: 2,
                              paddingHorizontal: 8,
                              borderRadius: 20,
                              borderWidth: 1,
                              borderColor: alpha(m.paid_at ? t0.gr : t0.ye, 30),
                              backgroundColor: alpha(m.paid_at ? t0.gr : t0.ye, 12),
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: m.paid_at ? t0.gr : t0.ye }}>
                              {m.paid_at ? t('manual_paid_badge') : t('manual_unpaid_badge')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: m.entry_type === 'income' ? t0.gr : t0.tx }}>
                        {m.entry_type === 'income' ? '+' : '−'}
                        {fmtEur(Number(m.amount))}
                      </Text>
                      <RemoveBtn onPress={() => void fin.removeManual(m.id)} label={t('manual_delete')} />
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {/* Mês importado */}
            <SectionLabel t={t0}>{fill(t('act_sec_imported'), { month: pastMonth })}</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingBottom: 4 }} style={{ marginBottom: 11 }}>
              <CatPill label={t('act_filter_all')} on={filter === 'all'} onPress={() => setFilter('all')} />
              {presentCats.map((c) => (
                <CatPill key={c} label={catLabel(c)} category={c} on={filter === c} onPress={() => setFilter(c)} />
              ))}
            </ScrollView>
            {unknownCount > 0 ? (
              <Text style={{ fontSize: 11.5, color: t0.tx2, lineHeight: 17, marginHorizontal: 2, marginBottom: 8 }}>
                {fill(t('act_categorize_hint'), { count: unknownCount })}
              </Text>
            ) : null}

            <Card t={t0}>
              {filteredTxs.map((tx, i) => {
                const showDate = i === 0 || filteredTxs[i - 1]!.tx_date !== tx.tx_date;
                const merchant = prettyMerchant(tx.description);
                const open = catFor === merchant;
                return (
                  <View key={`${tx.tx_date}-${i}`}>
                    {showDate ? (
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: t0.tx3,
                          letterSpacing: 0.5,
                          paddingTop: 5,
                          paddingBottom: 6,
                          marginBottom: 2,
                          borderBottomWidth: 1,
                          borderBottomColor: t0.b,
                        }}
                      >
                        {dayShort(tx.tx_date)}
                      </Text>
                    ) : null}
                    {/* Tocar num movimento corrige a categoria. A correção vale
                        para o COMERCIANTE, não para a linha: o mesmo sítio chega
                        do banco com descritivos diferentes e voltaria a aparecer
                        por identificar no mês seguinte. */}
                    <Pressable
                      onPress={() => setCatFor(open ? null : merchant)}
                      style={[txRowStyle, { borderBottomWidth: i === filteredTxs.length - 1 ? 0 : 1, borderBottomColor: t0.b }]}
                    >
                      <CatChip category={tx.category} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: t0.tx }}>{merchant}</Text>
                        <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 1 }}>{catLabel(tx.category)}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: tx.tx_type === 'income' ? t0.gr : t0.tx }}>
                        {tx.tx_type === 'income' ? '+' : '−'}
                        {fmtEur(Number(tx.amount))}
                      </Text>
                    </Pressable>
                    {open ? (
                      <View style={{ paddingTop: 2, paddingBottom: 12, paddingHorizontal: 2 }}>
                        <Text style={{ fontSize: 11, color: t0.tx2, lineHeight: 17, marginBottom: 7 }}>
                          {fill(t('act_cat_scope'), { merchant, n: merchantCount.get(merchant) ?? 1 })}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingBottom: 4 }}>
                          {MANUAL_CATS.map((c) => (
                            <CatPill
                              key={c}
                              label={catLabel(c)}
                              category={c}
                              on={tx.category === c}
                              onPress={() => {
                                setCatFor(null);
                                void fin.setTxCategory(merchant, c);
                              }}
                            />
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </>
        ) : (
          <>
            {/* Subscrições: detetadas + manuais, com a pergunta "usas?" */}
            <Card t={t0} style={{ marginBottom: 11, paddingVertical: 13, paddingHorizontal: 15 }}>
              <Text style={{ fontSize: 12, color: t0.tx2 }}>
                {fill(t('subs_active_total'), { n: activeSubs.length, amount: `−${fmtEur(subsTotal)}` })}
              </Text>
            </Card>

            {subs.map((s) => {
              const statusKey: Record<string, DictKey> = {
                confirmed: 'subs_state_confirmed',
                rejected: 'subs_state_rejected',
                cancelled: 'subs_state_cancelled',
              };
              const isManual = s.import_id === null || s.import_id === undefined;
              const unknown = s.user_status === 'unknown';
              return (
                <Card key={s.id} t={t0} style={{ marginBottom: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: unknown ? 10 : 8 }}>
                    <CatChip category="subscricoes" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: t0.tx,
                          textDecorationLine: s.user_status === 'cancelled' ? 'line-through' : 'none',
                        }}
                      >
                        {prettyMerchant(s.name)}
                      </Text>
                      <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 1 }}>
                        {isManual ? t('subs_manual_tag') : t('cat_subscricoes')}
                        {!unknown ? <Text style={{ fontWeight: '800', color: t0.tx2 }}>{`   ${t(statusKey[s.user_status]!)}`}</Text> : null}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: t0.tx }}>−{fmtEur(Number(s.price))}/mês</Text>
                    {isManual ? <RemoveBtn onPress={() => void fin.removeSubscription(s.id)} label={t('manual_delete')} /> : null}
                  </View>
                  {unknown ? (
                    <>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx2, marginBottom: 7 }}>{t('subs_q')}</Text>
                      <View style={{ flexDirection: 'row', gap: 7 }}>
                        {verdictBtn(t('subs_confirm'), t0.tx, () => void fin.setSubVerdict(s.id, 'confirmed'))}
                        {verdictBtn(t('subs_reject'), t0.tx2, () => void fin.setSubVerdict(s.id, 'rejected'))}
                        {verdictBtn(t('subs_cancel'), t0.re, () => void fin.setSubVerdict(s.id, 'cancelled'))}
                      </View>
                    </>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 7 }}>
                      {verdictBtn(t('subs_restore'), t0.tx2, () => void fin.setSubVerdict(s.id, 'unknown'))}
                    </View>
                  )}
                </Card>
              );
            })}

            {/* Adicionar subscrição manual */}
            {showSubForm ? (
              <Card t={t0}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Input value={sName} onChangeText={setSName} placeholder={t('subs_add_name')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input value={sPrice} onChangeText={setSPrice} placeholder={t('subs_add_price')} numeric />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => void addSub()}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: t0.rs, alignItems: 'center', backgroundColor: t0.pr }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{t('manual_save')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowSubForm(false)}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: t0.rs, alignItems: 'center', backgroundColor: t0.card2, borderWidth: 1, borderColor: t0.b }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx }}>{t('goal_cancel')}</Text>
                  </Pressable>
                </View>
              </Card>
            ) : (
              <Pressable
                onPress={() => setShowSubForm(true)}
                style={{
                  paddingVertical: 14,
                  alignItems: 'center',
                  borderRadius: t0.r,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: alpha(t0.pr, 45),
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: t0.pr }}>{t('subs_add')}</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
