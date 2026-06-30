// JWordSearch service worker
// Bump CACHE_VERSION any time index.html or any cached asset changes, so
// returning players get the update instead of a stale cached copy.
const CACHE_VERSION = 'jwordsearch-v2'; // Bumped to v2 to force an update!

// App shell: same-origin files this page needs to run.
const APP_SHELL = [
  './',
  './index.html', // FIX 1: Changed to lowercase 'i' so GitHub doesn't throw a 404
  './manifest.json',
];

// External assets hosted on GitHub Pages — sounds, banners, and icons.
// These rarely change, so they're cached aggressively.
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

// FIX 2: Network First approach for fetching updates
self.addEventListener('fetch', (event) => {
  // Only handle GET requests; let everything else pass through untouched.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // 1. Try fetching from the Network FIRST
    fetch(event.request)
      .then((response) => {
        // If the network succeeds, save a fresh copy to the cache
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response; // Return the fresh network response to the app
      })
      .catch(() => {
        // 2. If the network fails (user is offline), fallback to the CACHE
        return caches.match(event.request).then((cached) => {
          if (cached) {
            return cached;
          }
          // Offline and not cached — nothing more we can do for this request.
          return new Response('Offline and this resource is not cached yet.', {
            status: 503,
            statusText: 'Offline',
          });
        });
      })
  );
});