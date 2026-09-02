import { Fragment, type ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Os mesmos traços da web (`apps/web/src/components/CategoryIcon.tsx`), em
 * react-native-svg. Regra de design: os chips de categoria são NEUTROS — a cor
 * semântica vive nos valores (+verde/−vermelho), não nos ícones.
 */
const S = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const PATHS = (c: string): Record<string, ReactNode> => ({
  habitacao: (
    <Fragment>
      <Path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" stroke={c} {...S} />
      <Path d="M9 21v-6h6v6" stroke={c} {...S} />
    </Fragment>
  ),
  alimentacao: (
    <Fragment>
      <Path d="M3 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" stroke={c} {...S} />
      <Path d="M5 2v20" stroke={c} {...S} />
      <Path d="M19 2c-2 2-3 4.5-3 7v2h3v11" stroke={c} {...S} />
    </Fragment>
  ),
  transporte: (
    <Fragment>
      <Path d="M5 17H3V7a1 1 0 0 1 1-1h10l4 5h2a1 1 0 0 1 1 1v5h-2" stroke={c} {...S} />
      <Circle cx="7.5" cy="17.5" r="1.8" stroke={c} {...S} />
      <Circle cx="16.5" cy="17.5" r="1.8" stroke={c} {...S} />
    </Fragment>
  ),
  lazer: (
    <Fragment>
      <Path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" stroke={c} {...S} />
      <Path d="m10 9 5 3-5 3V9Z" stroke={c} {...S} />
    </Fragment>
  ),
  subscricoes: (
    <Fragment>
      <Rect x="3" y="5" width="18" height="14" rx="2" stroke={c} {...S} />
      <Path d="M3 10h18" stroke={c} {...S} />
    </Fragment>
  ),
  saude: <Path d="M12 21s-7-4.5-9-9c-1.5-3.5.5-7 4-7 2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 5.5 3.5 4 7-2 4.5-9 9-9 9Z" stroke={c} {...S} />,
  educacao: (
    <Fragment>
      <Path d="M22 10 12 5 2 10l10 5 10-5Z" stroke={c} {...S} />
      <Path d="M6 12v5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-5" stroke={c} {...S} />
    </Fragment>
  ),
  transferencias: <Path d="M4 8h16l-4-4M20 16H4l4 4" stroke={c} {...S} />,
  receita: (
    <Fragment>
      <Circle cx="12" cy="12" r="9" stroke={c} {...S} />
      <Path d="M12 7v10M8.5 10.5 12 7l3.5 3.5" stroke={c} {...S} />
    </Fragment>
  ),
  outros: (
    <Fragment>
      <Circle cx="5" cy="12" r="1.6" stroke={c} {...S} />
      <Circle cx="12" cy="12" r="1.6" stroke={c} {...S} />
      <Circle cx="19" cy="12" r="1.6" stroke={c} {...S} />
    </Fragment>
  ),
});

export function CategoryIcon({ category, size = 17, color }: { category: string; size?: number; color: string }) {
  const paths = PATHS(color);
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {paths[category] ?? paths.outros}
    </Svg>
  );
}
