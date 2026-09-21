// OurTimeline Service Worker - Network-First for Instant Updates
const CACHE_NAME = 'ourtimeline-v2.1.3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/config.js',
  './js/crypto.js',
  './js/store.js',
  './js/supabaseClient.js',
  './js/imageCompressor.js',
  './js/timelineRenderer.js',
  './js/modalController.js',
  './js/onThisDay.js',
  './js/treeGrowth.js',
  './js/milestonePredictor.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Supabase API, WebSocket (Realtime), 外部CDNなどはネットワーク直接
  const url = new URL(event.request.url);
  if (
    url.origin.includes('supabase.co') ||
    url.protocol.startsWith('ws') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-First 戦略: 常にネットワークから最新を取得しキャッシュを更新。オフライン時のみキャッシュ利用
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        // オフライン時のフォールバック
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
