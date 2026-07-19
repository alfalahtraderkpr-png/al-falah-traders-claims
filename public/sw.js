const CACHE_NAME = 'al-falah-claims-v5';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// URLs that should NEVER be cached (always go to network)
const NEVER_CACHE = [
  '/api/auth/me',
  '/api/auth/login',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Handle skip waiting message from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch with timeout — if network is slow, fall back to cache
function fetchWithTimeout(request, ms = 5000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);
    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For auth endpoints — ALWAYS network only, NEVER cache
  if (NEVER_CACHE.some((path) => url.pathname.includes(path))) {
    event.respondWith(
      fetchWithTimeout(event.request, 8000)
        .catch(() => new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }))
    );
    return;
  }

  // For other API calls, network first with 5s timeout, fallback to cache
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetchWithTimeout(event.request, 5000)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) =>
          cached || new Response(JSON.stringify({ error: 'Network error' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        ))
    );
    return;
  }

  // For JS/CSS chunks and Next.js static assets — ALWAYS network first
  // This prevents stale cached chunks causing "Cannot access before initialization" errors
  if (
    url.pathname.includes('/_next/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For other static assets (images, fonts, etc.), cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
