import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { I18nProvider, LANG_COOKIE } from '@/lib/i18n';
import { RegisterServiceWorker } from '@/components/PwaSetup';
import type { Lang } from '@/lib/i18n/dict';
import './globals.css';

export const metadata: Metadata = {
  title: 'OptiFi',
  description: 'Controlo de despesas, subscrições e otimização financeira.',
  applicationName: 'OptiFi',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  // Instalada no iPhone, corre em ecrã inteiro com o nome curto por baixo do ícone.
  appleWebApp: { capable: true, title: 'OptiFi', statusBarStyle: 'black-translucent' },
  // App privada: nada disto deve aparecer em motores de busca.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // O zoom fica ligado de propósito: numa app de finanças há quem precise de
  // ampliar os números. O salto de zoom ao tocar num campo resolve-se pondo os
  // inputs a 16px (ver globals.css), não proibindo o utilizador de ampliar.
  // Pinta a barra de estado do telemóvel com o fundo real de cada tema.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0e14' },
  ],
  // Pinta por baixo do notch e do indicador de home — o CSS trata das margens.
  viewportFit: 'cover',
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
        {/* O iOS anterior ao 16.4 ignora o manifest: sem esta meta com o prefixo
            apple-, a app adicionada ao ecrã principal abria dentro do Safari. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RegisterServiceWorker />
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
