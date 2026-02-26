// ============================================================
// Service Worker — Literacia Financeira PWA
// Estratégia: Cache First para assets estáticos
//             Network First para chamadas à API (Supabase/Edge)
// ============================================================

const CACHE_NAME    = 'lf-v1';
const CACHE_URLS    = [
  '/',
  '/index.html',
  // Fontes Google (cached automaticamente pelo browser na 1ª visita)
];

// ── Install: pre-cache shell da app ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: limpar caches antigas ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estratégia por tipo de request ────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase e Edge Functions — sempre network (dados em tempo real)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Google Fonts e CDN — cache first
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // App shell (HTML/CSS/JS local) — network first, fallback cache
  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Guardar resposta fresca na cache
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
