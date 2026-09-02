import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import Svg, { G, Line, Path, Rect, Circle } from 'react-native-svg';
import { fmtEur, fmtEur0 } from '@optifi/core';
import type { Theme } from './theme';

export interface CashflowPoint {
  label: string;
  income: number;
  expenses: number;
}

const H = 150;
const PAD_L = 42;
const PAD_B = 20;
const PAD_T = 8;

/** A mesma grelha da web: `rgba(122,138,170,.09)` — lê-se sem se ver. */
const GRID = 'rgba(122,138,170,0.09)';

/**
 * Receitas e despesas em barras, o líquido em linha, por mês importado. É o
 * mesmo gráfico da web, mas desenhado à mão em SVG: o Chart.js precisa de um
 * <canvas>, que não existe em React Native.
 */
export function CashflowChart({
  points,
  t,
  width,
  labels,
}: {
  points: CashflowPoint[];
  t: Theme;
  width: number;
  labels: { net: string; income: string; expenses: string };
}) {
  // A web mostra os valores ao passar o rato. Num telemóvel não há rato: o
  // mesmo detalhe abre ao tocar no mês, e volta a fechar no segundo toque.
  const [sel, setSel] = useState<number | null>(null);

  if (points.length === 0) return null;

  const nets = points.map((p) => p.income - p.expenses);
  const top = Math.max(1, ...points.map((p) => Math.max(p.income, p.expenses)), ...nets);
  const bottom = Math.min(0, ...nets);
  const span = top - bottom || 1;

  const plotW = width - PAD_L;
  const plotH = H - PAD_B - PAD_T;
  const y = (v: number) => PAD_T + ((top - v) / span) * plotH;
  const slot = plotW / points.length;
  const barW = Math.min(14, slot / 3.2);

  // Quatro marcas chegam para ler a escala sem encher o cartão de linhas.
  const ticks = [0, 1, 2, 3].map((i) => bottom + (span * i) / 3);

  // A web usa `tension: 0.35` do Chart.js — uma curva de Bézier cardinal. Isto
  // é a mesma coisa escrita à mão: cada troço leva pontos de controlo a um
  // terço da distância, na direção dos vizinhos.
  const pts = nets.map((n, i) => ({ x: PAD_L + slot * i + slot / 2, y: y(n) }));
  const TENSION = 0.35;
  const line = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1]!;
      const before = pts[i - 2] ?? prev;
      const after = pts[i + 1] ?? p;
      const c1x = prev.x + ((p.x - before.x) / 6) * TENSION * 2;
      const c1y = prev.y + ((p.y - before.y) / 6) * TENSION * 2;
      const c2x = p.x - ((after.x - prev.x) / 6) * TENSION * 2;
      const c2y = p.y - ((after.y - prev.y) / 6) * TENSION * 2;
      return `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p.x} ${p.y}`;
    })
    .join(' ');

  return (
    <View style={{ marginTop: 12 }}>
      <Svg width={width} height={H}>
        {ticks.map((v, i) => (
          <G key={i}>
            <Line x1={PAD_L} y1={y(v)} x2={width} y2={y(v)} stroke={GRID} strokeWidth={1} />
          </G>
        ))}
        {sel !== null ? (
          <Line
            x1={PAD_L + slot * sel + slot / 2}
            y1={PAD_T}
            x2={PAD_L + slot * sel + slot / 2}
            y2={H - PAD_B}
            stroke={t.tx3}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}
        {points.map((p, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          const zero = y(0);
          return (
            <G key={p.label + i} opacity={sel === null || sel === i ? 1 : 0.35}>
              <Rect
                x={cx - barW - 1.5}
                y={y(p.income)}
                width={barW}
                height={Math.max(1, zero - y(p.income))}
                rx={3}
                fill={t.gr}
              />
              <Rect
                x={cx + 1.5}
                y={y(p.expenses)}
                width={barW}
                height={Math.max(1, zero - y(p.expenses))}
                rx={3}
                fill={t.re}
              />
            </G>
          );
        })}
        <Path d={line} stroke={t.chartNet} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {nets.map((n, i) => (
          <Circle key={i} cx={PAD_L + slot * i + slot / 2} cy={y(n)} r={3.5} fill={t.chartNet} />
        ))}
      </Svg>

      {/* Uma faixa invisível por mês em vez de medir o toque em coordenadas:
          cada mês fica com a sua zona, sem contas de geometria à mão. */}
      <View style={{ position: 'absolute', left: PAD_L, top: 0, height: H - PAD_B, flexDirection: 'row' }}>
        {points.map((p, i) => (
          <Pressable
            key={p.label + i}
            onPress={() => setSel((s) => (s === i ? null : i))}
            style={{ width: slot, height: '100%' }}
          />
        ))}
      </View>

      {sel !== null && points[sel] ? (
        <View
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            top: 2,
            // Encostado ao lado oposto do mês tocado, para não o tapar.
            left: PAD_L + slot * sel + slot / 2 > (PAD_L + plotW) / 2 ? PAD_L + 4 : undefined,
            right: PAD_L + slot * sel + slot / 2 > (PAD_L + plotW) / 2 ? undefined : 4,
            backgroundColor: 'rgba(10,14,22,0.92)',
            borderRadius: 8,
            paddingVertical: 7,
            paddingHorizontal: 10,
          }}
        >
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#fff', marginBottom: 3 }}>
            {points[sel].label}
          </Text>
          {[
            { c: t.gr, l: labels.income, v: points[sel].income },
            { c: t.re, l: labels.expenses, v: points[sel].expenses },
            { c: t.chartNet, l: labels.net, v: points[sel].income - points[sel].expenses },
          ].map((row) => (
            <View key={row.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: row.c }} />
              <Text style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.82)' }}>
                {row.l}: {fmtEur(row.v)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Escala e rótulos em <Text> e não em <Svg><Text>: assim seguem a fonte
          e o tamanho do sistema, como o resto da app. */}
      <View style={{ pointerEvents: 'none', position: 'absolute', left: 0, top: 0, height: H, width: PAD_L }}>
        {ticks.map((v, i) => (
          <Text
            key={i}
            style={{ position: 'absolute', top: y(v) - 6, right: 6, fontSize: 9, color: t.tx3 }}
          >
            {fmtEur0(v)}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginLeft: PAD_L, marginTop: -14 }}>
        {points.map((p, i) => (
          <Text key={p.label + i} style={{ width: slot, fontSize: 9.5, color: t.tx3, textAlign: 'center' }}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function ChartLegend({ t, labels }: { t: Theme; labels: { net: string; income: string; expenses: string } }) {
  const items = [
    { c: t.gr, l: labels.income },
    { c: t.re, l: labels.expenses },
    { c: t.chartNet, l: labels.net },
  ];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 10 }}>
      {items.map((it) => (
        <View key={it.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: it.c }} />
          <Text style={{ fontSize: 10, fontWeight: '600', color: t.tx3 }}>{it.l}</Text>
        </View>
      ))}
    </View>
  );
}
