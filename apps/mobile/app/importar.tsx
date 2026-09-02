import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../src/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  decodeStatementText,
  ingestStatement,
  parseCsv,
  pdfContentStart,
  IngestError,
  type BankId,
  type ColumnMapping,
} from '@optifi/ingest';
import { saveImport, SaveImportError } from '@optifi/data';
import type { DictKey } from '@optifi/core';
import { supabase } from '../src/lib/supabase';
import { useFinance } from '../src/lib/finance';
import { useI18n } from '../src/lib/i18n';
import { alpha, Button, Card, Screen, SectionLabel } from '../src/ui';
import { useTheme } from '../src/lib/theme-context';
import type { Theme } from '../src/theme';


type Bank = BankId | 'outro';

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

/** Os erros do parser já têm texto escrito; o resto cai no genérico. */
const ERROR_KEY: Record<string, DictKey> = {
  unknown_format: 'wiz_err_unknown_format',
  no_valid_rows: 'wiz_err_no_valid_rows',
  file_size: 'wiz_err_file_size',
  pdf_unreadable: 'wiz_err_pdf',
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** O que o utilizador escolhe no mapeador; vira `ColumnMapping` no fim. */
type MapDraft = {
  headerRow: number;
  dateCol: number;
  descriptionCol: number;
  mode: 'signed' | 'split';
  amountCol: number;
  debitCol: number;
  creditCol: number;
};

const MAP_DEFAULT: MapDraft = {
  headerRow: 0,
  dateCol: 0,
  descriptionCol: 1,
  mode: 'signed',
  amountCol: 2,
  debitCol: 2,
  creditCol: 3,
};

function toMapping(d: MapDraft): ColumnMapping {
  const base = { headerRow: d.headerRow, dateCol: d.dateCol, descriptionCol: d.descriptionCol };
  return d.mode === 'signed'
    ? { ...base, amountCol: d.amountCol }
    : { ...base, debitCol: d.debitCol, creditCol: d.creditCol };
}

/**
 * Sem `<select>` no nativo: a escolha é uma fila de pastilhas que rola na
 * horizontal — o mesmo padrão dos filtros de categoria na Atividade.
 */
function PillRow<V extends string | number>({
  t,
  label,
  options,
  value,
  onChange,
}: {
  t: Theme;
  label: string;
  options: { value: V; text: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={{ marginBottom: 11 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: t.tx2, marginBottom: 6 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: on ? t.pr : t.b,
                backgroundColor: on ? t.pr : t.card,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : t.tx2 }}>{o.text}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function Importar() {
  const t0 = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reload } = useFinance();
  const { t } = useI18n();
  const [bank, setBank] = useState<Bank>('revolut');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DictKey | ''>('');
  // Extrato que a app não reconheceu: guardamos os bytes para o poder importar
  // outra vez assim que o utilizador disser o que é cada coluna.
  const [pendingBytes, setPendingBytes] = useState<Uint8Array | null>(null);
  const [mapRows, setMapRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<MapDraft>(MAP_DEFAULT);

  async function runImport(bytes: Uint8Array, withMapping?: MapDraft) {
    setError('');
    setBusy(true);
    try {
      const result = ingestStatement(bytes, {
        ...(bank === 'outro' ? {} : { bankHint: bank }),
        ...(withMapping ? { mapping: toMapping(withMapping) } : {}),
      });

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setError('wiz_err_generic');
        return;
      }
      // Corre no aparelho e escreve com o login do próprio utilizador: o RLS
      // do Supabase é a mesma barreira que havia do lado do servidor.
      await saveImport(supabase, data.user.id, result.bank, result.summary);
      await reload();
      router.back();
    } catch (e) {
      if (e instanceof IngestError) {
        // Formato desconhecido à primeira: em vez de desistir, mostramos as
        // primeiras linhas e deixamos o utilizador identificar as colunas.
        if (e.code === 'unknown_format' && !withMapping) {
          setPendingBytes(bytes);
          setMapRows(parseCsv(decodeStatementText(bytes)).slice(0, 8));
          setMapping(MAP_DEFAULT);
        }
        setError(ERROR_KEY[e.code] ?? 'wiz_err_generic');
      } else if (e instanceof SaveImportError) setError('wiz_err_generic');
      else setError('wiz_err_generic');
    } finally {
      setBusy(false);
    }
  }

  async function pickAndImport() {
    setError('');
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;

    let bytes: Uint8Array;
    try {
      bytes = await new File(asset.uri).bytes();
    } catch {
      setError('wiz_err_generic');
      return;
    }
    if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) {
      setError('wiz_err_file_size');
      return;
    }
    // O PDF precisa de extrair texto de um formato binário, e a biblioteca
    // que o faz só corre em Node. Dizê-lo é melhor do que falhar com um erro
    // que parece um ficheiro estragado.
    if (pdfContentStart(bytes) >= 0) {
      setError('wiz_err_pdf_mobile');
      return;
    }
    await runImport(bytes);
  }

  function cancelMapping() {
    setPendingBytes(null);
    setMapRows([]);
    setError('');
  }

  // ── Mapeador de colunas ──
  if (pendingBytes && mapRows.length > 0) {
    const headerCells = mapRows[mapping.headerRow] ?? [];
    const colOptions = headerCells.map((c, i) => ({
      value: i,
      text: `${i + 1} — ${c.slice(0, 24) || t('map_col_empty')}`,
    }));
    return (
      <Screen t={t0}>
        <ScrollView contentContainerStyle={{ padding: 13, paddingTop: insets.top + 12, paddingBottom: 28 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5 }}>
            {t('wiz_map_title')}
          </Text>
          <Text style={{ fontSize: 12.5, color: t0.tx2, lineHeight: 18, marginTop: 4, marginBottom: 14 }}>
            {t('wiz_map_sub')}
          </Text>

          <Card t={t0}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ borderWidth: 1, borderColor: t0.b, borderRadius: t0.rs }}>
                {mapRows.map((r, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: i === mapping.headerRow ? alpha(t0.pr, 12) : 'transparent',
                      borderBottomWidth: i === mapRows.length - 1 ? 0 : 1,
                      borderBottomColor: t0.b,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: t0.tx3, paddingVertical: 4, paddingHorizontal: 6, width: 24 }}>
                      {i + 1}
                    </Text>
                    {r.map((c, j) => (
                      <Text
                        key={j}
                        numberOfLines={1}
                        style={{ fontSize: 11, color: t0.tx2, paddingVertical: 4, paddingHorizontal: 8, minWidth: 70 }}
                      >
                        {c.slice(0, 24)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>

            <PillRow
              t={t0}
              label={t('map_header_row')}
              value={mapping.headerRow}
              options={mapRows.map((_, i) => ({ value: i, text: String(i + 1) }))}
              onChange={(v: number) => setMapping({ ...mapping, headerRow: v })}
            />
            <PillRow
              t={t0}
              label={t('map_date')}
              value={mapping.dateCol}
              options={colOptions}
              onChange={(v: number) => setMapping({ ...mapping, dateCol: v })}
            />
            <PillRow
              t={t0}
              label={t('map_desc')}
              value={mapping.descriptionCol}
              options={colOptions}
              onChange={(v: number) => setMapping({ ...mapping, descriptionCol: v })}
            />
            <PillRow
              t={t0}
              label={t('map_mode')}
              value={mapping.mode}
              options={[
                { value: 'signed', text: t('map_mode_signed') },
                { value: 'split', text: t('map_mode_split') },
              ]}
              onChange={(v: 'signed' | 'split') => setMapping({ ...mapping, mode: v })}
            />
            {mapping.mode === 'signed' ? (
              <PillRow
                t={t0}
                label={t('map_amount')}
                value={mapping.amountCol}
                options={colOptions}
                onChange={(v: number) => setMapping({ ...mapping, amountCol: v })}
              />
            ) : (
              <>
                <PillRow
                  t={t0}
                  label={t('map_debit')}
                  value={mapping.debitCol}
                  options={colOptions}
                  onChange={(v: number) => setMapping({ ...mapping, debitCol: v })}
                />
                <PillRow
                  t={t0}
                  label={t('map_credit')}
                  value={mapping.creditCol}
                  options={colOptions}
                  onChange={(v: number) => setMapping({ ...mapping, creditCol: v })}
                />
              </>
            )}
          </Card>

          {error ? (
            <Card t={t0} style={{ marginBottom: 11, borderColor: t0.re }}>
              <Text style={{ fontSize: 12.5, color: t0.re, fontWeight: '700', lineHeight: 18 }}>{t(error)}</Text>
            </Card>
          ) : null}

          {busy ? (
            <View style={{ alignItems: 'center', paddingVertical: 18, gap: 10 }}>
              <ActivityIndicator color={t0.pr} />
              <Text style={{ fontSize: 12.5, color: t0.tx2 }}>{t('wiz_processing')}</Text>
            </View>
          ) : (
            <Button t={t0} label={t('map_apply')} onPress={() => void runImport(pendingBytes, mapping)} />
          )}

          <View style={{ height: 10 }} />
          <Button t={t0} label={t('wiz_back')} onPress={cancelMapping} variant="ghost" />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen t={t0}>
      <ScrollView contentContainerStyle={{ padding: 13, paddingTop: insets.top + 12, paddingBottom: 28 }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: t0.tx, letterSpacing: -0.5 }}>
          {t('wiz_title')}
        </Text>
        <Text style={{ fontSize: 12.5, color: t0.tx2, lineHeight: 18, marginTop: 4, marginBottom: 14 }}>
          {t('wiz_sub')}
        </Text>

        <Card t={t0} style={{ marginBottom: 11 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BANKS.map((b) => {
              const on = bank === b.id;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setBank(b.id)}
                  style={{
                    minWidth: '47%',
                    flexGrow: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderRadius: t0.rs,
                    borderWidth: 1,
                    borderColor: on ? t0.pr : t0.b,
                    backgroundColor: on ? t0.card2 : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: on ? t0.pr : t0.tx2 }}>{b.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card t={t0} style={{ marginBottom: 11 }}>
          <SectionLabel t={t0}>{BANKS.find((b) => b.id === bank)?.name}</SectionLabel>
          {GUIDES[bank].map((k, i) => (
            <View key={k} style={{ flexDirection: 'row', gap: 9, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: t0.pr, width: 14 }}>{i + 1}</Text>
              <Text style={{ flex: 1, fontSize: 12.5, color: t0.tx2, lineHeight: 18 }}>{t(k)}</Text>
            </View>
          ))}
        </Card>

        {error ? (
          <Card t={t0} style={{ marginBottom: 11, borderColor: t0.re }}>
            <Text style={{ fontSize: 12.5, color: t0.re, fontWeight: '700', lineHeight: 18 }}>{t(error)}</Text>
          </Card>
        ) : null}

        {/* A mesma zona tracejada da web. Aqui não há arrastar — o `wiz_drop`
            fala em arrastar e ficaria a mentir, por isso o título é o
            `wiz_pick_file`, que é o que o toque faz mesmo. */}
        <Pressable
          onPress={() => void pickAndImport()}
          disabled={busy}
          style={{
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: busy ? alpha(t0.pr, 18) : alpha(t0.pr, 32),
            borderRadius: t0.r,
            paddingVertical: 32,
            paddingHorizontal: 18,
            alignItems: 'center',
            marginBottom: 11,
          }}
        >
          {busy ? (
            <>
              <ActivityIndicator color={t0.pr} />
              <Text style={{ fontSize: 12.5, color: t0.tx2, marginTop: 10 }}>{t('wiz_processing')}</Text>
            </>
          ) : (
            <>
              <Svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke={t0.pr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <Path d="m17 8-5-5-5 5" />
                <Path d="M12 3v12" />
              </Svg>
              <Text style={{ fontSize: 14, fontWeight: '800', color: t0.tx, marginTop: 10, marginBottom: 8, textAlign: 'center' }}>
                {t('wiz_pick_file')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {['CSV', 'PDF'].map((x) => (
                  <Text
                    key={x}
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: t0.pr,
                      backgroundColor: alpha(t0.pr, 10),
                      borderWidth: 1,
                      borderColor: alpha(t0.pr, 20),
                      borderRadius: 20,
                      paddingVertical: 2,
                      paddingHorizontal: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {x}
                  </Text>
                ))}
              </View>
            </>
          )}
        </Pressable>

        <View
          style={{
            flexDirection: 'row',
            gap: 7,
            padding: 10,
            paddingHorizontal: 12,
            borderRadius: t0.rs,
            backgroundColor: alpha(t0.gr, 9),
          }}
        >
          <Svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke={t0.gr} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1 }}>
            <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            <Path d="m9 12 2 2 4-4" />
          </Svg>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: t0.tx2, lineHeight: 16 }}>
            {t('wiz_privacy_strong')}
          </Text>
        </View>

        <View style={{ height: 10 }} />
        <Button t={t0} label={t('goal_cancel')} onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </Screen>
  );
}
