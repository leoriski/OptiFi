'use client';

// Gráfico do balcard de cashflow — barras de receitas/despesas por mês
// importado + linha do líquido, como no protótipo (Chart.js). O mês corrente
// entra com os movimentos manuais registados até agora.

import { useEffect, useRef } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Legend, Tooltip);

export interface CashflowPoint {
  label: string;
  income: number;
  expenses: number;
}

export function CashflowChart({ points, labels }: { points: CashflowPoint[]; labels: { net: string; income: string; expenses: string } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const gr = v('--gr', '#22C55E');
    const re = v('--re', '#F43F5E');
    const net = v('--chart-net', '#0EA5E9');
    const tx3 = v('--tx3', '#5C6781');
    // A app carrega Manrope e mais nada. O gráfico pedia 'Inter', que não
    // existe aqui, e o Chart.js caía no serif por omissão — os eixos e a
    // legenda apareciam com serifas no meio de uma página sem nenhuma.
    const font = 'Manrope, sans-serif';

    // Gráfico misto (barras + linha): o tipo base é 'bar' e a linha vem do
    // dataset — o cast é necessário porque os tipos do Chart.js não modelam
    // bem datasets mistos.
    const config = {
      type: 'bar',
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            type: 'line',
            label: labels.net,
            data: points.map((p) => p.income - p.expenses),
            borderColor: net,
            backgroundColor: net,
            pointBackgroundColor: net,
            pointBorderColor: net,
            pointRadius: 3.5,
            borderWidth: 2.5,
            tension: 0.35,
            order: 0,
          },
          {
            type: 'bar',
            label: labels.income,
            data: points.map((p) => p.income),
            backgroundColor: gr,
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.9,
            categoryPercentage: 0.7,
            maxBarThickness: 18,
            order: 1,
          },
          {
            type: 'bar',
            label: labels.expenses,
            data: points.map((p) => p.expenses),
            backgroundColor: re,
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.9,
            categoryPercentage: 0.7,
            maxBarThickness: 18,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // O canvas é bitmap: ao contrário do texto em HTML, não reflui nem
        // reamostra. Por omissão o Chart.js desenha a window.devicePixelRatio,
        // o que num ecrã a 1x deixa os números e as legendas moles ao lado do
        // resto da página. Desenhar sempre a pelo menos 2x custa uma imagem de
        // 630x280 em vez de 315x140 — irrelevante — e fica nítido em todo o
        // lado, incluindo ao ampliar.
        devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, color: tx3, font: { family: font, size: 10, weight: 600 }, padding: 12 },
          },
          tooltip: {
            backgroundColor: 'rgba(10,14,22,.92)',
            titleFont: { family: font, weight: 700 },
            bodyFont: { family: font },
            callbacks: {
              label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
                ` ${ctx.dataset.label ?? ''}: €${Number(ctx.parsed.y).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tx3, font: { family: font, size: 10 } },
          },
          y: {
            grid: { color: 'rgba(122,138,170,.09)' },
            ticks: {
              color: tx3,
              font: { family: font, size: 10 },
              callback: (val: string | number) => '€' + Number(val).toLocaleString('en-US'),
              maxTicksLimit: 5,
            },
            beginAtZero: true,
          },
        },
      },
    };

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, config as unknown as ChartConfiguration);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [points, labels]);

  if (points.length === 0) return null;
  return (
    <div className="cashflow-chart-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
