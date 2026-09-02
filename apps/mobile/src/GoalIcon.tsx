import { Fragment, type ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Ícone da meta deduzido do nome, como na web. Enquanto não houver um seletor
 * visual, adivinhar pelo nome é melhor do que pôr o mesmo símbolo em todas —
 * e quando errar, o pior que acontece é um alvo genérico.
 */
const S = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function GoalIcon({ name, size = 22, color }: { name: string; size?: number; color: string }) {
  const n = name.toLowerCase();
  const box = { width: size, height: size, viewBox: '0 0 24 24' };

  if (/viagem|viaje|trip|férias|ferias|japão|japao|travel/.test(n)) {
    return (
      <Svg {...box}>
        <Path
          d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"
          stroke={color}
          {...S}
        />
      </Svg>
    );
  }
  if (/casa|house|entrada|apartamento/.test(n)) {
    return (
      <Svg {...box}>
        <Path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" stroke={color} {...S} />
        <Path d="M9 21v-6h6v6" stroke={color} {...S} />
      </Svg>
    );
  }
  if (/carro|car|moto/.test(n)) {
    return (
      <Svg {...box}>
        <Path d="M5 17H3V7a1 1 0 0 1 1-1h10l4 5h2a1 1 0 0 1 1 1v5h-2" stroke={color} {...S} />
        <Circle cx="7.5" cy="17.5" r="1.8" stroke={color} {...S} />
        <Circle cx="16.5" cy="17.5" r="1.8" stroke={color} {...S} />
      </Svg>
    );
  }
  if (/emerg|fundo|reserva|segurança|seguranca/.test(n)) {
    return (
      <Svg {...box}>
        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} {...S} />
      </Svg>
    );
  }
  return (
    <Svg {...box}>
      <Circle cx="12" cy="12" r="9" stroke={color} {...S} />
      <Circle cx="12" cy="12" r="5" stroke={color} {...S} />
      <Circle cx="12" cy="12" r="1" stroke={color} {...S} />
    </Svg>
  );
}

/**
 * A outra família de ícones da web (`components/GoalIcon.tsx`): escolhida pelo
 * utilizador e guardada em `goals.icon_key`. A de cima adivinha pelo nome e é
 * só para o cartão do Início, onde não há nada a escolher.
 */
const KEY_PATHS = (c: string): Record<string, ReactNode> => ({
  target: (
    <Fragment>
      <Circle cx="12" cy="12" r="9" stroke={c} {...S} />
      <Circle cx="12" cy="12" r="5" stroke={c} {...S} />
      <Circle cx="12" cy="12" r="1" stroke={c} {...S} />
    </Fragment>
  ),
  home: (
    <Fragment>
      <Path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" stroke={c} {...S} />
      <Path d="M9 21v-6h6v6" stroke={c} {...S} />
    </Fragment>
  ),
  plane: (
    <Path
      d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"
      stroke={c}
      {...S}
    />
  ),
  car: (
    <Fragment>
      <Path d="M5 17H3V7a1 1 0 0 1 1-1h10l4 5h2a1 1 0 0 1 1 1v5h-2" stroke={c} {...S} />
      <Circle cx="7.5" cy="17.5" r="1.8" stroke={c} {...S} />
      <Circle cx="16.5" cy="17.5" r="1.8" stroke={c} {...S} />
    </Fragment>
  ),
  shield: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} {...S} />,
  heart: <Path d="M12 21s-7-4.5-9-9c-1.5-3.5.5-7 4-7 2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 5.5 3.5 4 7-2 4.5-9 9-9 9Z" stroke={c} {...S} />,
  graduation: (
    <Fragment>
      <Path d="M22 9 12 5 2 9l10 4 10-4Z" stroke={c} {...S} />
      <Path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" stroke={c} {...S} />
    </Fragment>
  ),
  trending: (
    <Fragment>
      <Path d="M3 17 9 11l4 4 8-8" stroke={c} {...S} />
      <Path d="M14 5h7v7" stroke={c} {...S} />
    </Fragment>
  ),
  laptop: (
    <Fragment>
      <Rect x="3" y="5" width="18" height="12" rx="2" stroke={c} {...S} />
      <Path d="M2 20h20" stroke={c} {...S} />
    </Fragment>
  ),
  gift: (
    <Fragment>
      <Rect x="3" y="8" width="18" height="4" rx="1" stroke={c} {...S} />
      <Path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" stroke={c} {...S} />
      <Path d="M12 8S10.5 3 8 4.5 9.5 8 12 8Zm0 0s1.5-5 4-3.5S14.5 8 12 8Z" stroke={c} {...S} />
    </Fragment>
  ),
  dumbbell: <Path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12" stroke={c} {...S} />,
  sailboat: (
    <Fragment>
      <Path d="M3 18h18l-2 3H5l-2-3Z" stroke={c} {...S} />
      <Path d="M12 3v12M12 3 5 15h7M12 6l6 9h-6" stroke={c} {...S} />
    </Fragment>
  ),
});

export const GOAL_ICON_KEYS = Object.keys(KEY_PATHS('#000'));

export function GoalIconByKey({ iconKey, size = 20, color }: { iconKey: string; size?: number; color: string }) {
  const paths = KEY_PATHS(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths[iconKey] ?? paths.target}
    </Svg>
  );
}
