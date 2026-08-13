// Service worker do OptiFi.
//
// Faz duas coisas: recebe notificações push (lembretes de metas) e dá à PWA o
// mínimo de vida offline. A regra que manda em tudo o resto é de privacidade:
// ISTO É UMA APP DE FINANÇAS, por isso NUNCA se guarda em cache uma resposta
// da API nem HTML de páginas autenticadas. Só entram no disco ficheiros
// estáticos com hash no nome (imutáveis) e a página de "sem ligação".
const VERSION = 'v1';
const STATIC_CACHE = `optifi-static-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, fontes: passam direto
  if (url.pathname.startsWith('/api/')) return; // dados do utilizador: nunca em cache

  // Ficheiros com hash no nome: o conteúdo nunca muda, logo cache-first é seguro.
  if (url.pathname.startsWith('/_next/static/') || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              void caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Navegação: sempre da rede (os números têm de ser os de agora). Só quando
  // não há ligação nenhuma é que se mostra a página de offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error())));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'OptiFi';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/metas' },
    tag: data.tag || 'optifi',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/metas';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
