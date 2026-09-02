// Metas — a mesma vista da web: resumo reservado/livre, cartões com o ícone
// escolhido (icon_key), barra de progresso, projeção do motor, estado da
// alocação do mês, e criar/editar numa folha que sobe de baixo.
//
// Diferenças deliberadas para a web, ambas por ser um telemóvel: o `prompt()`
// do levantamento é uma folha com um campo, e o `confirm()` de apagar é o
// alerta do sistema.

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../../src/Text';
import { useRouter } from 'expo-router';
import type { GoalRow } from '@optifi/data';
import { useFinance } from '../../src/lib/finance';
import { useI18n } from '../../src/lib/i18n';
import { fill, fmtEur, fmtEur0, monthLabel } from '@optifi/core';
import { alpha, Button, Card, Screen, Sheet } from '../../src/ui';
import { GoalIconByKey, GOAL_ICON_KEYS } from '../../src/GoalIcon';
import { CheckIcon } from '../../src/icons';
import { useTheme } from '../../src/lib/theme-context';


const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Data da projeção: 'jun 2027'. Escrito à mão — sem Intl no Hermes. */
const dateLabel = (d: Date): string => `${MESES_CURTOS[d.getMonth()]} ${d.getFullYear()}`;

interface FormState {
  id?: string;
  name: string;
  iconKey: string;
  target: string;
  current: string;
  month: number;
  year: number;
  alloc: string;
  allocDay: number;
}

const emptyForm = (): FormState => ({
  name: '',
  iconKey: 'target',
  target: '',
  current: '0',
  month: 12,
  year: new Date().getFullYear(),
  alloc: '0',
  allocDay: 1,
});

/** O `.auth-input` do protótipo. */
function Input({ value, onChangeText, placeholder, numeric }: { value: string; onChangeText: (v: string) => void; placeholder?: string; numeric?: boolean }) {
  const t0 = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t0.tx3}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      style={{
        backgroundColor: t0.card2,
        borderColor: t0.b,
        borderWidth: 1,
        borderRadius: t0.rs,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        color: t0.tx,
      }}
    />
  );
}

function FormLabel({ children }: { children: string }) {
  const t0 = useTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx2, marginTop: 12, marginBottom: 5 }}>{children}</Text>;
}

/** O `<select>` da web — no nativo, uma fila de pílulas que rola. */
function PillRow<T extends string | number>({ options, value, onChange, labelOf }: { options: T[]; value: T; onChange: (v: T) => void; labelOf: (v: T) => string }) {
  const t0 = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingBottom: 4 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: on ? t0.pr : t0.b,
              backgroundColor: on ? t0.pr : t0.card2,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: on ? '#fff' : t0.tx2 }}>{labelOf(o)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** O `.pill-btn`. */
function PillBtn({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const t0 = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: t0.rs, borderWidth: 1, borderColor: t0.b, backgroundColor: t0.card2 }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color: color ?? t0.tx2 }}>{label}</Text>
    </Pressable>
  );
}

export default function Metas() {
  const t0 = useTheme();
  const router = useRouter();
  const fin = useFinance();
  const { fin: snap, loading, reload } = fin;
  const { t } = useI18n();

  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  // Meta de onde se está a levantar + o valor escrito.
  const [withdrawFor, setWithdrawFor] = useState<GoalRow | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

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
    <Text style={{ fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5, marginBottom: 14 }}>{t('nav_goals')}</Text>
  );

  const { fs, imp, goals } = snap;
  if (!imp || !fs) {
    return (
      <Screen t={t0}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13, paddingBottom: 28 }}>
          {title}
          <Card t={t0} style={{ marginBottom: 11 }}>
            <Text style={{ fontSize: 13, color: t0.tx2, lineHeight: 19 }}>{t('empty_goals')}</Text>
          </Card>
          <Button t={t0} label={t('wiz_title')} onPress={() => router.push('/importar')} />
        </ScrollView>
      </Screen>
    );
  }

  const openEdit = (g: GoalRow) =>
    setForm({
      id: g.id,
      name: g.name,
      iconKey: g.icon_key || 'target',
      target: String(g.target_eur),
      current: String(g.current_eur),
      month: g.target_month ?? 12,
      year: g.target_year ?? new Date().getFullYear(),
      alloc: String(g.monthly_allocation),
      allocDay: g.allocation_day ?? 1,
    });

  const submit = async () => {
    if (!form || !form.name.trim() || !(parseFloat(form.target.replace(',', '.')) > 0)) return;
    await fin.saveGoal({
      ...(form.id !== undefined ? { id: form.id } : {}),
      name: form.name.trim(),
      icon_key: form.iconKey,
      target_eur: parseFloat(form.target.replace(',', '.')),
      current_eur: Math.max(0, parseFloat(form.current.replace(',', '.')) || 0),
      target_month: form.month,
      target_year: form.year,
      monthly_allocation: Math.max(0, parseFloat(form.alloc.replace(',', '.')) || 0),
      allocation_day: form.allocDay,
    });
    setForm(null);
  };

  const confirmDelete = (g: GoalRow) =>
    Alert.alert(t('goal_delete'), fill(t('goal_delete_confirm'), { name: g.name }), [
      { text: t('goal_cancel'), style: 'cancel' },
      { text: t('goal_delete'), style: 'destructive', onPress: () => void fin.deleteGoal(g.id) },
    ]);

  const doWithdraw = async () => {
    if (!withdrawFor) return;
    const v = parseFloat(withdrawAmount.replace(',', '.'));
    if (v > 0) await fin.withdrawFromGoal(withdrawFor.id, v);
    setWithdrawFor(null);
    setWithdrawAmount('');
  };

  const projLine = (goalId: string): { text: string; color: string } => {
    const p = fs.goalProjections[goalId];
    if (!p) return { text: '', color: t0.tx3 };
    if (p.state === 'done') return { text: t('goal_proj_done'), color: t0.tx2 };
    if (p.state === 'unallocated') return { text: t('goal_proj_none'), color: t0.tx3 };
    if (p.onTrack) return { text: fill(t('goal_proj_ontrack'), { date: dateLabel(p.estDate!), n: p.months! }), color: t0.tx2 };
    return { text: fill(t('goal_proj_late'), { date: dateLabel(p.estDate!), n: p.monthsLate! }), color: t0.tx2 };
  };

  const yearNow = new Date().getFullYear();
  // Mesma fonte que o Início: gastável do saldo real. Sem saldo definido, cai
  // na sobra do mês.
  const free = fs.spendableNow ?? fs.freeToSpend;
  const due = goals.filter((g) => fs.goalAllocationStatus[g.id] === 'due');
  const dueTotal = due.reduce((a, g) => a + Number(g.monthly_allocation), 0);
  const surplus = fs.net;
  const safeStart = Math.max(5, Math.round((surplus * 0.5) / 5) * 5);

  return (
    <Screen t={t0}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 13, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={t0.pr} />}
      >
        {title}

        {/* Resumo: reservado vs livre */}
        <View style={{ borderRadius: t0.r, padding: 16, marginBottom: 14, backgroundColor: alpha(t0.pr, 8), borderWidth: 1, borderColor: alpha(t0.pr, 20) }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: t0.tx3 }}>{t('goals_reserved')}</Text>
              <Text style={{ fontSize: 17, fontWeight: '900', color: t0.pr }}>{fmtEur(fs.allocatedTotal)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: t0.tx3 }}>{t('goals_free')}</Text>
              <Text style={{ fontSize: 17, fontWeight: '900', color: t0.tx }}>{fmtEur(free)}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 8 }}>{t('goals_free_note')}</Text>

          {/* Lembrete: metas com alocação vencida ainda por transferir. */}
          {due.length > 0 ? (
            <View style={{ marginTop: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: t0.rs, backgroundColor: t0.card2, borderWidth: 1, borderColor: t0.b }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: t0.tx }}>
                {fill(t('goal_alloc_reminder'), { n: due.length, amount: fmtEur(dueTotal) })}
              </Text>
            </View>
          ) : null}

          {fs.monthDeficit > 0 ? (
            <View style={{ marginTop: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: t0.rs, backgroundColor: alpha(t0.re, 12) }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: t0.re, lineHeight: 17 }}>
                {fill(t('goals_deficit'), { month: monthLabel(imp.statement_month), amount: fmtEur(fs.monthDeficit) })}
              </Text>
            </View>
          ) : null}

          {fs.overAllocated ? (
            <View style={{ marginTop: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: t0.rs, backgroundColor: alpha(t0.re, 12) }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: t0.re }}>
                {fill(t('goals_overalloc'), { amount: fmtEur(fs.overReserved) })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Sem metas: se o mês fechou com FOLGA, sugere um valor conservador
            (metade da folga) — nunca num mês negativo. */}
        {goals.length === 0 ? (
          <Card t={t0} style={{ marginBottom: 12 }}>
            {surplus > 20 ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: t0.tx, lineHeight: 20 }}>
                  {fill(t('goals_start_nudge'), { month: monthLabel(imp.statement_month), surplus: fmtEur(surplus), safe: fmtEur0(safeStart) })}
                </Text>
                <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 6 }}>{t('goals_start_note')}</Text>
              </>
            ) : (
              <Text style={{ fontSize: 12, color: t0.tx2, lineHeight: 18 }}>{t('goals_empty')}</Text>
            )}
          </Card>
        ) : null}

        {goals.map((g) => {
          const pct = Math.min(100, Math.round((Number(g.current_eur) / Number(g.target_eur)) * 100));
          const proj = projLine(g.id);
          const status = fs.goalAllocationStatus[g.id];
          const done = status === 'done';
          return (
            <Card key={g.id} t={t0} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t0.pr, 13) }}>
                  <GoalIconByKey iconKey={g.icon_key || 'target'} size={21} color={t0.pr} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '900', color: t0.tx }}>{g.name}</Text>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: t0.pr }}>{pct}%</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: t0.tx2, marginTop: 1 }}>
                    <Text style={{ fontWeight: '800', color: t0.tx }}>{fmtEur(Number(g.current_eur))}</Text>
                    {` / ${fmtEur(Number(g.target_eur))}`}
                  </Text>
                </View>
              </View>

              {/* .goal-prog / .goal-fill */}
              <View style={{ height: 5, borderRadius: 3, backgroundColor: t0.b, marginTop: 5, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${pct}%`, borderRadius: 3, backgroundColor: t0.pr }} />
              </View>

              {proj.text ? (
                <Text style={{ fontSize: 11, fontWeight: '700', color: proj.color, marginTop: 8, marginBottom: 4 }}>{proj.text}</Text>
              ) : null}

              {Number(g.monthly_allocation) > 0 ? (
                <Text style={{ fontSize: 11, color: t0.tx3, marginBottom: 6 }}>
                  {fmtEur(Number(g.monthly_allocation))}
                  {t('goal_alloc_short')}
                  {` · ${fill(t('goal_alloc_day_short'), { day: g.allocation_day ?? 1 })}`}
                </Text>
              ) : null}

              {/* Estado da alocação deste mês: já alocado / por alocar / agendado */}
              {status && status !== 'none' ? (
                <Pressable
                  onPress={() => void (done ? fin.unmarkGoalAllocated(g.id) : fin.markGoalAllocated(g.id))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 9,
                    paddingHorizontal: 11,
                    marginBottom: 6,
                    borderRadius: t0.rs,
                    borderWidth: 1,
                    borderColor: done ? alpha(t0.gr, 35) : t0.b,
                    backgroundColor: done ? alpha(t0.gr, 8) : t0.card2,
                  }}
                >
                  <View
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 5,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: done ? 0 : 1.5,
                      borderColor: t0.tx3,
                      backgroundColor: done ? t0.gr : 'transparent',
                    }}
                  >
                    {done ? <CheckIcon color={t0.bg} size={11} /> : null}
                  </View>
                  <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '700', color: done ? t0.gr : t0.tx }}>
                    {done ? t('goal_alloc_done') : status === 'due' ? t('goal_alloc_due') : t('goal_alloc_scheduled')}
                  </Text>
                </Pressable>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 7, marginTop: 6, alignItems: 'center' }}>
                <PillBtn label={t('goal_edit')} onPress={() => openEdit(g)} />
                {Number(g.current_eur) > 0 ? (
                  <PillBtn
                    label={t('goal_withdraw')}
                    onPress={() => {
                      setWithdrawFor(g);
                      setWithdrawAmount('');
                    }}
                  />
                ) : null}
                <View style={{ flex: 1 }} />
                <PillBtn label={t('goal_delete')} color={t0.re} onPress={() => confirmDelete(g)} />
              </View>
            </Card>
          );
        })}

        <Button t={t0} label={t('goal_add')} onPress={() => setForm(emptyForm())} />
      </ScrollView>

      {/* Folha: nova/editar meta */}
      <Sheet
        t={t0}
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? t('goal_edit') : t('goal_add')}
        closeLabel={t('goal_cancel')}
      >
        {form ? (
          <Card t={t0}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t0.pr, 14) }}>
                <GoalIconByKey iconKey={form.iconKey} size={24} color={t0.pr} />
              </View>
              <View style={{ flex: 1 }}>
                <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={t('goal_name')} />
              </View>
            </View>

            <FormLabel>{t('goal_icon')}</FormLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GOAL_ICON_KEYS.map((key) => {
                const active = key === form.iconKey;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setForm({ ...form, iconKey: key })}
                    accessibilityRole="button"
                    accessibilityLabel={key}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? t0.pr : t0.b,
                      backgroundColor: active ? alpha(t0.pr, 16) : t0.card2,
                    }}
                  >
                    <GoalIconByKey iconKey={key} size={18} color={active ? t0.pr : t0.tx2} />
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FormLabel>{t('goal_target')}</FormLabel>
                <Input value={form.target} onChangeText={(v) => setForm({ ...form, target: v })} numeric />
              </View>
              <View style={{ flex: 1 }}>
                <FormLabel>{t('goal_current')}</FormLabel>
                <Input value={form.current} onChangeText={(v) => setForm({ ...form, current: v })} numeric />
              </View>
            </View>

            <FormLabel>{t('goal_date')}</FormLabel>
            <PillRow
              options={Array.from({ length: 12 }, (_, i) => i + 1)}
              value={form.month}
              onChange={(m) => setForm({ ...form, month: m })}
              labelOf={(m) => MESES[m - 1]!}
            />
            <View style={{ height: 8 }} />
            <PillRow
              options={Array.from({ length: 11 }, (_, i) => yearNow + i)}
              value={form.year}
              onChange={(y) => setForm({ ...form, year: y })}
              labelOf={(y) => String(y)}
            />

            <FormLabel>{t('goal_alloc_lbl')}</FormLabel>
            <Input value={form.alloc} onChangeText={(v) => setForm({ ...form, alloc: v })} numeric />

            <FormLabel>{t('goal_alloc_day_lbl')}</FormLabel>
            <PillRow
              options={Array.from({ length: 28 }, (_, i) => i + 1)}
              value={form.allocDay}
              onChange={(d) => setForm({ ...form, allocDay: d })}
              labelOf={(d) => fill(t('goal_alloc_day_opt'), { day: d })}
            />
            <Text style={{ fontSize: 10, color: t0.tx3, marginTop: 4 }}>{t('goal_alloc_day_note')}</Text>

            <View style={{ height: 16 }} />
            <Button t={t0} label={t('goal_save')} onPress={() => void submit()} />
            <View style={{ height: 8 }} />
            <Button t={t0} label={t('goal_cancel')} onPress={() => setForm(null)} variant="ghost" />
          </Card>
        ) : null}
      </Sheet>

      {/* Folha: levantar de uma meta (o `prompt()` da web) */}
      <Sheet
        t={t0}
        open={withdrawFor !== null}
        onClose={() => setWithdrawFor(null)}
        title={t('goal_withdraw')}
        sub={withdrawFor?.name}
        closeLabel={t('goal_cancel')}
      >
        {withdrawFor ? (
          <Card t={t0}>
            <Text style={{ fontSize: 12.5, color: t0.tx2, lineHeight: 18, marginBottom: 10 }}>
              {fill(t('goal_withdraw_prompt'), { max: fmtEur(Number(withdrawFor.current_eur)) })}
            </Text>
            <Input value={withdrawAmount} onChangeText={setWithdrawAmount} numeric placeholder="0,00" />
            <View style={{ height: 12 }} />
            <Button t={t0} label={t('goal_withdraw')} onPress={() => void doWithdraw()} />
            <View style={{ height: 8 }} />
            <Button t={t0} label={t('goal_cancel')} onPress={() => setWithdrawFor(null)} variant="ghost" />
          </Card>
        ) : null}
      </Sheet>
    </Screen>
  );
}
