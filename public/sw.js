const CACHE_NAME = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(PRECACHE))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names
    .filter(name => name.startsWith('stand-fronts-') && name !== CACHE_NAME)
    .map(name => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html', { ignoreVary: true })));
    return;
  }
  event.respondWith(caches.match(request, { ignoreVary: true })
    .then(cached => cached || fetch(request)));
});
