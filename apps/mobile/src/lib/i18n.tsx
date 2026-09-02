import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DICTS, type DictKey, type Lang } from '@optifi/core';

/**
 * O dicionário vive no `@optifi/core` para as duas apps dizerem as coisas pelas
 * mesmas palavras. Aqui só está a parte que é do telemóvel: guardar a escolha
 * no aparelho, porque não há cookies como na web.
 */
const KEY = 'optifi_lang';

interface I18nValue {
  lang: Lang;
  t: (key: DictKey) => string;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<I18nValue>({
  lang: 'pt',
  t: (k) => DICTS.pt[k] ?? k,
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('pt');

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'en' || v === 'pt') setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    void AsyncStorage.setItem(KEY, l);
  }, []);

  const t = useCallback((key: DictKey) => DICTS[lang][key] ?? key, [lang]);

  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(Ctx);
}

export type { DictKey, Lang };
