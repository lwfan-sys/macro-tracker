const CACHE_NAME = 'macro-tracker-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Skip API calls entirely — don't cache or intercept
  if (e.request.url.includes('generativelanguage.googleapis.com')) return;

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // Network-first: try network, fall back to cache
  e.respondWith(
    fetch(e.request).then(response => {
      if (response.ok && e.request.url.startsWith(self.location.origin)) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
