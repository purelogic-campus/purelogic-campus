const CACHE_NAME = 'pure-logic-v1.4.7';

// Definition aller statischen Assets inkl. aller 10 Länderflaggen mit relativen Pfaden
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css?v=6',
  './manifest.json',
  './icons/flags/bks.svg',
  './icons/flags/de.svg',
  './icons/flags/en.svg',
  './icons/flags/es.svg',
  './icons/flags/fr.svg',
  './icons/flags/hu.svg',
  './icons/flags/it.svg',
  './icons/flags/pl.svg',
  './icons/flags/tr.svg',
  './icons/flags/uk.svg',
  './js/config.js?v=6',
  './js/state.js?v=6',
  './js/i18n.js?v=6',
  './js/auth.js?v=6',
  './js/network.js?v=6',
  './js/main.js?v=6',
  './js/features/notifications.js?v=6',
  './js/features/lecture.js?v=6',
  './js/features/quiz.js?v=6',
  './js/features/profguide.js?v=6',
  './js/features/live.js?v=6',
  './js/features/crush.js?v=6',
  './js/features/feed.js?v=6',
  './js/features/dm.js?v=6',
  './js/features/board.js?v=6',
  './js/features/ranking.js?v=6'
];

// Installation: Grundgerüst, Assets und Länderflaggen cachen
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        STATIC_ASSETS.map(async (assetUrl) => {
          try {
            const response = await fetch(assetUrl, { cache: 'no-cache' });
            if (response && response.ok) {
              await cache.put(assetUrl, response);
            }
          } catch (err) {
            console.warn('SW Pre-Cache Hinweis für Asset:', assetUrl, err);
          }
        })
      );
    })
  );
});

// Aktivierung: Alte Caches bereinigen und neue Version übernehmen
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

// Fallback-Antwort bei fehlender Verbindung für API-/Datenabfragen
function createOfflineFallbackResponse(request) {
  const acceptsJson = (request.headers.get('accept') || '').includes('application/json');
  if (acceptsJson) {
    return new Response(
      JSON.stringify({
        offline: true,
        error: 'Keine Internetverbindung. Bitte verbinde dich erneut, um Live-Daten abzurufen.'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }

  return new Response('Offline – keine Netzwerkverbindung verfügbar.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

// Fetch-Handling: Network-First mit sauberem Cache- & Offline-Fallback
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Nur GET-Requests verarbeiten
  if (event.request.method !== 'GET') {
    return;
  }

  // Externe Supabase-API-Calls direkt ausführen, bei Netzwerkausfall kontrollierten Fallback liefern
  if (requestUrl.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => createOfflineFallbackResponse(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && requestUrl.origin === location.origin) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          const indexFallback = await caches.match('./index.html');
          if (indexFallback) {
            return indexFallback;
          }
        }
        return createOfflineFallbackResponse(event.request);
      })
  );
});