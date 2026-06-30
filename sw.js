// JWordSearch service worker
// Bump CACHE_VERSION any time Index.html or any cached asset changes, so
// returning players get the update instead of a stale cached copy.
const CACHE_VERSION = 'jwordsearch-v1';

// App shell: same-origin files this page needs to run.
const APP_SHELL = [
  './',
  './Index.html',
  './manifest.json',
];

// External assets hosted on GitHub Pages — sounds, banners, and icons.
// These rarely change, so they're cached aggressively (cache-first).
const EXTERNAL_ASSETS = [
  'https://chenguibe.github.io/JWordSearch/SOUND_CORRECT.mp3',
  'https://chenguibe.github.io/JWordSearch/SOUND_WRONG.mp3',
  'https://chenguibe.github.io/JWordSearch/SOUND_COMPLETE.mp3',
  'https://chenguibe.github.io/JWordSearch/SOUND_HIGHSCORE.mp3',
  'https://chenguibe.github.io/JWordSearch/SOUND_CLEAR.mp3',
  'https://chenguibe.github.io/JWordSearch/TOP_BANNER.jpeg',
  'https://chenguibe.github.io/JWordSearch/BOTTOM_BANNER.jpeg',
  'https://chenguibe.github.io/JWordSearch/icon192.png',
  'https://chenguibe.github.io/JWordSearch/icon512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Same-origin files: a normal cache.addAll is fine here.
      const sameOrigin = cache.addAll(APP_SHELL);

      // Cross-origin files: fetched individually with mode 'no-cors'.
      // GitHub Pages doesn't send permissive CORS headers for arbitrary
      // file types, so a regular cross-origin fetch can fail to cache.
      // 'no-cors' mode produces an "opaque" response — we can't inspect
      // its status, but it can still be cached and served back to <img>/
      // <audio> elements, which is all we need here. (Since we've already
      // confirmed these exact URLs are live, the opacity tradeoff is safe.)
      const crossOrigin = Promise.all(
        EXTERNAL_ASSETS.map((url) =>
          fetch(url, { mode: 'no-cors' })
            .then((res) => cache.put(url, res))
            .catch((err) => console.warn('SW: failed to precache', url, err))
        )
      );

      return Promise.all([sameOrigin, crossOrigin]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests; let everything else pass through untouched.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // Not cached yet (e.g. first-ever load, or a new asset) — fetch from
      // the network, and opportunistically cache it for next time.
      return fetch(event.request)
        .then((response) => {
          // Only cache successful, basic (same-origin) responses here;
          // opaque cross-origin responses from a plain fetch can't be
          // safely vetted, so they're left to the install-time precache.
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached — nothing more we can do for this request.
          return new Response('Offline and this resource is not cached yet.', {
            status: 503,
            statusText: 'Offline',
          });
        });
    })
  );
});
