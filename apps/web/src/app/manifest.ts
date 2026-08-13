import type { MetadataRoute } from 'next';

// Manifest da PWA — é o que torna a OptiFi instalável no ecrã inicial e faz o
// iOS/Android abri-la sem barra de browser. Servido em /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OptiFi — Controlo de despesas',
    short_name: 'OptiFi',
    description: 'Controlo de despesas, subscrições e otimização financeira.',
    lang: 'pt-PT',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0E14',
    theme_color: '#0B0E14',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Recortável: o Android aplica a sua própria máscara (círculo, squircle…)
      // e corta até 20% de cada lado, por isso este tem o logo mais pequeno.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
