import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../src/lib/session';
import { loadFinance, type MobileFinance } from '../src/lib/finance';
import { fmtEur, fill, monthLabel } from '../src/format';
import { buildTheme } from '../src/theme';
import { Button, Card, Screen, SectionLabel } from '../src/ui';

const t = buildTheme('light', 'emerald');

export default function Home() {
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();
  const [fin, setFin] = useState<MobileFinance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setFin(await loadFinance());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!fin && !error) {
    return (
      <Screen t={t}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.pr} />
        </View>
      </Screen>
    );
  }

  const fs = fin?.state ?? null;
  const subsDue = fs?.subsPending;
  // Sem âncora de saldo o motor devolve null: a app não tem como saber quanto
  // está livre, e mostrar zero seria mentir. Por isso o cartão e o aviso das
  // subscrições só aparecem quando há um número verdadeiro para mostrar.
  const spendable = fs?.spendableNow ?? null;

  return (
    <Screen t={t}>
      <ScrollView
        contentContainerStyle={{ padding: 13, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.pr} />}
      >
        <Text style={{ fontSize: 20, fontWeight: '900', color: t.tx, letterSpacing: -0.5 }}>
          {fin?.name ? `Olá, ${fin.name}` : 'Início'}
        </Text>
        <Text style={{ fontSize: 12, color: t.tx2, marginBottom: 13 }}>
          {fin ? monthLabel(fin.planMonth) : ''}
        </Text>

        {error ? (
          <Card t={t}>
            <Text style={{ color: t.re, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>{error}</Text>
            <Button t={t} label="Tentar outra vez" onPress={() => void load()} variant="ghost" />
          </Card>
        ) : null}

        {fs && fin?.balanceSet && fs.currentBalance !== null && spendable !== null ? (
          <Card t={t} style={{ marginBottom: 11 }}>
            <Text
              style={{
                fontSize: 11,
                color: t.tx2,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 3,
              }}
            >
              Saldo
            </Text>
            <Text style={{ fontSize: 30, fontWeight: '900', color: t.tx, letterSpacing: -1, marginBottom: 11 }}>
              {fmtEur(fs.currentBalance)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <View>
                <Text style={{ fontSize: 10, color: t.tx2 }}>Reservado</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: t.tx, marginTop: 1 }}>
                  {fmtEur(fs.allocatedTotal)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 10, color: t.tx2 }}>Livre</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: t.pr, marginTop: 1 }}>
                  {fmtEur(spendable)}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* O mesmo aviso da web: as subscrições saem da conta todos os meses e
            não estão nas despesas registadas, por isso o "livre" conta-as como
            disponível. Não se descontam à força — a app não sabe o dia da
            cobrança e o saldo copiado do banco pode já as excluir. */}
        {subsDue && subsDue.total > 0 && fs && spendable !== null ? (
          <Card t={t} style={{ marginBottom: 11, borderColor: t.ye }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: t.tx, marginBottom: 4 }}>
              Ainda faltam pagar as subscrições
            </Text>
            <Text style={{ fontSize: 12, color: t.tx2, lineHeight: 18, marginBottom: 10 }}>
              {fill(
                'Estes {n} serviços custam {amount} por mês e não estão nas tuas despesas deste mês. Se ainda não saíram da conta, o que te sobra mesmo é {after}.',
                {
                  n: subsDue.items.length,
                  amount: fmtEur(subsDue.total),
                  after: fmtEur(Math.round((spendable - subsDue.total) * 100) / 100),
                },
              )}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {subsDue.items.map((s) => (
                <Text
                  key={s.name}
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: t.tx2,
                    backgroundColor: t.card2,
                    borderRadius: 20,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    overflow: 'hidden',
                  }}
                >
                  {s.name} · {fmtEur(s.price)}
                </Text>
              ))}
            </View>
          </Card>
        ) : null}

        {fs ? (
          <Card t={t} style={{ marginBottom: 11 }}>
            <SectionLabel t={t}>Saúde financeira</SectionLabel>
            <Text style={{ fontSize: 30, fontWeight: '900', color: t.tx, letterSpacing: -1 }}>
              {fs.score.total}
              <Text style={{ fontSize: 15, color: t.tx3, fontWeight: '800' }}>/100</Text>
            </Text>
            <Text style={{ fontSize: 12, color: t.tx2, marginTop: 4 }}>
              Ritmo seguro: {fmtEur(fs.safePace.weeklyPace)} por semana
            </Text>
          </Card>
        ) : null}

        {fin && !fs && !error ? (
          <Card t={t}>
            <Text style={{ fontSize: 13, color: t.tx2, lineHeight: 19 }}>
              Ainda não importaste nenhum extrato. Faz isso em optifi.app e os números aparecem aqui.
            </Text>
          </Card>
        ) : null}

        <View style={{ marginTop: 18 }}>
          <Button t={t} label="Sair" onPress={() => void signOut()} variant="ghost" />
        </View>
      </ScrollView>
    </Screen>
  );
}
