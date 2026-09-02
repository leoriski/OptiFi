'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { DICTS, type DictKey, type Lang } from '@optifi/core';

interface I18nCtx {
  lang: Lang;
  t: (key: DictKey) => string;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<I18nCtx | null>(null);

export const LANG_COOKIE = 'optifi_lang';

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `${LANG_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = l === 'pt' ? 'pt-PT' : 'en';
  }, []);

  const t = useCallback((key: DictKey) => DICTS[lang][key] ?? key, [lang]);

  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export type { DictKey, Lang };
