// Angelo Service Worker — 3-cache strategy
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `angelo-static-${CACHE_VERSION}`;
const API_CACHE = `angelo-api-${CACHE_VERSION}`;
const SHELL_CACHE = `angelo-shell-${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, API_CACHE, SHELL_CACHE];

// --- Install: precache offline fallback ---
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(['/offline.html']))
  );
  self.skipWaiting();
});

// --- Activate: clean old caches, claim clients ---
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('angelo-') && !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Fetch strategies ---
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET (mutations go straight to network)
  if (request.method !== 'GET') return;

  // Skip cross-origin
  if (url.origin !== self.location.origin) return;

  // Strategy: Static assets — CacheFirst
  if (isStaticAsset(url)) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy: API data — StaleWhileRevalidate
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Strategy: App pages — NetworkFirst
  if (isAppPage(url)) {
    e.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // Strategy: Next.js chunks — CacheFirst (hashed filenames = immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
});

// --- Helpers ---

function isStaticAsset(url) {
  return /\.(woff2?|png|ico|svg|jpg|jpeg|webp|css|js)$/.test(url.pathname)
    && !url.pathname.startsWith('/_next/');
}

function isAppPage(url) {
  const p = url.pathname;
  return p === '/' || p === '/dashboard' || p.startsWith('/project/')
    || p === '/tasks' || p === '/mission' || p.startsWith('/mission/')
    || p === '/session' || p.startsWith('/session/')
    || p === '/skills' || p === '/deployments' || p === '/board' || p === '/more';
}

// CacheFirst: serve from cache, fallback to network + cache
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// StaleWhileRevalidate: serve cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  // Return cached immediately if available, otherwise wait for network
  if (cached) {
    // Fire-and-forget background revalidation
    fetchPromise;
    return cached;
  }
  const response = await fetchPromise;
  return response || new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

// NetworkFirst: try network, fallback to cache, then offline page
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/offline.html');
  }
}
