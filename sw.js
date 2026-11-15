// ============================================================================
// PURE LOGIC • Service Worker (sw.js)
// ============================================================================

const CACHE_NAME = 'pure-logic-v1.4.2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=2',
  '/manifest.json',
  '/js/config.js?v=2',
  '/js/state.js?v=2',
  '/js/i18n.js?v=2',
  '/js/auth.js?v=2',
  '/js/main.js?v=2',
  '/js/features/lecture.js?v=2',
  '/js/features/quiz.js?v=2',
  '/js/features/profguide.js?v=2',
  '/js/features/live.js?v=2',
  '/js/features/crush.js?v=2',
  '/js/features/feed.js?v=2',
  '/js/features/dm.js?v=2',
  '/js/features/board.js?v=2',
  '/js/features/ranking.js?v=2'
];

// Installation: Grundgerüst cachen
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW Pre-Cache Hinweis:', err);
      });
    })
  );
});

// Aktivierung: Alte Caches aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch-Handling: Network-First für App-Dateien, Supabase-API immer direkt
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Nur GET-Requests und keine externen Supabase-API-Calls cachen
  if (event.request.method !== 'GET' || requestUrl.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Erfolgreiche Antwort im Cache aktualisieren
        if (networkResponse && networkResponse.status === 200 && requestUrl.origin === location.origin) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline-Fallback aus dem Cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});