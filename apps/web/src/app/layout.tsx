import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { I18nProvider, LANG_COOKIE } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n/dict';
import './globals.css';

export const metadata: Metadata = {
  title: 'OptiFi',
  description: 'Controlo de despesas, subscrições e otimização financeira.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0E14',
};

// Aplica tema guardado antes do primeiro paint (evita flash). Espelha o
// applyTheme() do protótipo: modo + accent em localStorage.
const themeInit = `(function(){try{var m=localStorage.getItem('optifi_mode');if(m!=='light')m='dark';var a=localStorage.getItem('optifi_accent');if(['brand','amber','violet','emerald'].indexOf(a)<0)a='brand';var r=document.documentElement;r.setAttribute('data-mode',m);r.setAttribute('data-accent',a);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get(LANG_COOKIE)?.value;
  const lang: Lang = langCookie === 'en' ? 'en' : 'pt';

  return (
    <html lang={lang === 'pt' ? 'pt-PT' : 'en'} data-mode="dark" data-accent="brand" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
