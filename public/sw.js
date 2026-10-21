const CACHE_NAME = 'ege-9-13-ios27-v3';
const CORE_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'WARM_ASSETS' && Array.isArray(event.data.urls)) {
    const urls = event.data.urls;
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.all(
          urls.map((url) =>
            cache.match(url).then((hit) => (hit ? null : cache.add(url).catch(() => {})))
          )
        )
      )
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // 1. Immutable Vite hashed assets (/assets/*) and static icons: Cache-First (0ms cold start)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // 2. App Shell navigation (/ or /index.html): Instant Stale-While-Revalidate for 0ms Web App cold start
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedShell =
          (await cache.match(request)) ||
          (await cache.match('/index.html')) ||
          (await cache.match('/'));

        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put('/index.html', response.clone());
              cache.put('/', response.clone());
            }
            return response;
          })
          .catch(() => cachedShell);

        return cachedShell || networkFetch;
      })
    );
  }
});
