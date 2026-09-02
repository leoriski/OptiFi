import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTheme, type Accent, type Mode, type Theme } from '../theme';

/**
 * O tema escolhido pelo utilizador, para a app inteira.
 *
 * Na web isto eram dois atributos no `<html>` e o CSS cascateava sozinho. Aqui
 * não há cascata: o tema é um objeto que cada ecrã lê por `useTheme()`. Por
 * isso é um contexto e não uma variável — mudar o modo tem de voltar a
 * desenhar tudo, não só o ecrã do Perfil.
 *
 * As chaves são as mesmas da web (`optifi_mode`, `optifi_accent`), no
 * armazenamento do aparelho em vez do localStorage.
 */
const MODE_KEY = 'optifi_mode';
const ACCENT_KEY = 'optifi_accent';

const ACCENTS: Accent[] = ['emerald', 'brand', 'amber', 'violet'];

interface ThemeValue {
  t: Theme;
  mode: Mode;
  accent: Accent;
  setMode: (m: Mode) => void;
  setAccent: (a: Accent) => void;
}

const fallback = buildTheme('light', 'emerald');

const Ctx = createContext<ThemeValue>({
  t: fallback,
  mode: 'light',
  accent: 'emerald',
  setMode: () => {},
  setAccent: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('light');
  const [accent, setAccentState] = useState<Accent>('emerald');

  useEffect(() => {
    void AsyncStorage.multiGet([MODE_KEY, ACCENT_KEY]).then((pairs) => {
      for (const [k, v] of pairs) {
        if (k === MODE_KEY && (v === 'dark' || v === 'light')) setModeState(v);
        if (k === ACCENT_KEY && v && (ACCENTS as string[]).includes(v)) setAccentState(v as Accent);
      }
    });
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    void AsyncStorage.setItem(MODE_KEY, m);
  }, []);

  const setAccent = useCallback((a: Accent) => {
    setAccentState(a);
    void AsyncStorage.setItem(ACCENT_KEY, a);
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({ t: buildTheme(mode, accent), mode, accent, setMode, setAccent }),
    [mode, accent, setMode, setAccent],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** O tema atual. É isto que substitui o `buildTheme()` fixo em cada ecrã. */
export function useTheme(): Theme {
  return useContext(Ctx).t;
}

/** Só o ecrã do Perfil precisa de mudar o tema. */
export function useThemeControls(): ThemeValue {
  return useContext(Ctx);
}

export { ACCENTS };
export type { Accent, Mode };
