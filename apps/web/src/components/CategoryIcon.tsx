'use client';

// Ícones SVG por categoria — substituem os emojis do protótipo antigo,
// seguindo a regra do sistema visual (traço 2px, herda a cor via stroke).

const PATHS: Record<string, React.ReactNode> = {
  habitacao: (
    <>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  alimentacao: (
    <>
      <path d="M3 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
      <path d="M5 2v20" />
      <path d="M19 2c-2 2-3 4.5-3 7v2h3v11" />
    </>
  ),
  transporte: (
    <>
      <path d="M5 17H3V7a1 1 0 0 1 1-1h10l4 5h2a1 1 0 0 1 1 1v5h-2" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  lazer: (
    <>
      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      <path d="m10 9 5 3-5 3V9Z" />
    </>
  ),
  subscricoes: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  saude: (
    <path d="M12 21s-7-4.5-9-9c-1.5-3.5.5-7 4-7 2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 5.5 3.5 4 7-2 4.5-9 9-9 9Z" />
  ),
  educacao: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-5" />
    </>
  ),
  transferencias: (
    <>
      <path d="M4 8h16l-4-4M20 16H4l4 4" />
    </>
  ),
  receita: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M8.5 10.5 12 7l3.5 3.5" />
    </>
  ),
  outros: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
};

/**
 * Regra de design (limpeza à Revolut): os chips de categoria são NEUTROS —
 * a cor semântica vive nos valores (+verde/−vermelho), não nos ícones.
 * O mapa mantém-se por compatibilidade, mas tudo aponta para o neutro.
 */
const NEUTRAL = 'var(--tx2)';
export const CATEGORY_COLOR: Record<string, string> = {
  habitacao: NEUTRAL,
  alimentacao: NEUTRAL,
  transporte: NEUTRAL,
  lazer: NEUTRAL,
  subscricoes: NEUTRAL,
  saude: NEUTRAL,
  educacao: NEUTRAL,
  transferencias: NEUTRAL,
  receita: NEUTRAL,
  outros: NEUTRAL,
};

export function CategoryIcon({ category, size = 17, color = 'currentColor' }: { category: string; size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[category] ?? PATHS.outros}
    </svg>
  );
}
