/* GrooFlow PWA — caché mínima del shell (no cachea API ni datos). */
const CACHE = 'grooflow-shell-v1';
const SHELL = ['/grooflow/', '/grooflow/index.html', '/grooflow/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Nunca cachear API ni assets con hash (Vite los versiona).
  if (url.pathname.includes('/grooflow/api') || url.pathname.includes('/assets/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put('/grooflow/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/grooflow/index.html'))
    );
  }
});
