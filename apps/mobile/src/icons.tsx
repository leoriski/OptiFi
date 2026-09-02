import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Os mesmos desenhos do `BottomNav` da web, traço a traço. São contornos com
 * `strokeWidth` fixo em vez de formas cheias: a cor vem de fora, por isso o
 * mesmo ícone serve para o separador aceso e para o apagado sem haver duas
 * versões de cada um para manter sincronizadas.
 */
export interface IconProps {
  color: string;
  size?: number;
}

function base(size: number) {
  return { width: size, height: size, viewBox: '0 0 24 24' };
}

const S = { strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

export function HomeIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" stroke={color} {...S} />
    </Svg>
  );
}

export function InsightsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M3 3v18h18" stroke={color} {...S} />
      <Path d="m7 14 4-4 3 3 5-6" stroke={color} {...S} />
    </Svg>
  );
}

export function ActivityIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M8 6h13M8 12h13M8 18h13" stroke={color} {...S} />
      <Circle cx="4" cy="6" r="1" stroke={color} {...S} />
      <Circle cx="4" cy="12" r="1" stroke={color} {...S} />
      <Circle cx="4" cy="18" r="1" stroke={color} {...S} />
    </Svg>
  );
}

export function GoalsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx="12" cy="12" r="9" stroke={color} {...S} />
      <Circle cx="12" cy="12" r="5" stroke={color} {...S} />
      <Circle cx="12" cy="12" r="1" stroke={color} {...S} />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx="12" cy="8" r="4" stroke={color} {...S} />
      <Path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" stroke={color} {...S} />
    </Svg>
  );
}

/** Olho aberto/riscado do campo de password. */
/** Chama do crachá de meses seguidos — cheia, é um selo e não um contorno. */
export function FlameIcon({ color, size = 13 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M12 2c1 3-1 4-2 6-1 2 0 4 2 4 1.5 0 2.5-1 2.5-2 1.5 1.5 2.5 3.5 2.5 5.5A7 7 0 0 1 5 15c0-3 2-5 3-7 1.3-1.6 3.2-3 4-6Z"
        fill={color}
      />
    </Svg>
  );
}

export function CheckIcon({ color, size = 36 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M20 6 9 17l-5-5" stroke={color} {...S} strokeWidth={2} />
    </Svg>
  );
}

/** Garfo e faca — a tira do cartão refeição. */
export function MealIcon({ color, size = 19 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M6 3v7a2.5 2.5 0 0 0 5 0V3M8.5 10v11" stroke={color} {...S} strokeWidth={2} />
      <Path d="M18 3c-1.7 1.2-2.5 3-2.5 5.5S16.3 12 18 12.5V21" stroke={color} {...S} strokeWidth={2} />
    </Svg>
  );
}

export function EyeIcon({ color, size = 18, off = false }: IconProps & { off?: boolean }) {
  if (off) {
    return (
      <Svg {...base(size)}>
        <Path
          d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
          stroke={color}
          {...S}
        />
        <Path d="M1 1 23 23" stroke={color} {...S} />
      </Svg>
    );
  }
  return (
    <Svg {...base(size)}>
      <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke={color} {...S} />
      <Circle cx="12" cy="12" r="3" stroke={color} {...S} />
    </Svg>
  );
}
