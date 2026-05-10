/**
 * Cápsula ERP — Service Worker
 *
 * Estrategia de cacheo:
 *   - Assets fingerprinted de Next.js (/_next/static/*) → cache-first inmutable.
 *   - Iconos, manifest, logo → cache-first.
 *   - HTML (navegación) → network-first con fallback a cache, y si no hay
 *     cache → /offline.
 *   - Server actions, /api/*, POST/PUT/DELETE/PATCH → NUNCA cacheados.
 *     Pasan directo a network. Si fallan, error real (la cola offline a
 *     nivel de app se construirá en otra fase, no en el SW).
 *
 * Versionado: incrementar CACHE_VERSION para invalidar el cache anterior.
 * Cambio nuevo → activación inmediata si la página envía 'SKIP_WAITING'.
 */

const CACHE_VERSION = 'capsula-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = '/offline';

// Recursos que pre-cacheamos en install (mínimo crítico para el shell offline).
const PRECACHE_URLS = [
    OFFLINE_URL,
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png',
];

// ── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
    );
});

// ── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((k) => !k.startsWith(CACHE_VERSION))
                    .map((k) => caches.delete(k))
            );
            await self.clients.claim();
        })()
    );
});

// ── MESSAGE: actualización inmediata cuando el cliente lo solicita ──────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. Solo manejamos requests del mismo origen.
    if (url.origin !== self.location.origin) return;

    // 2. Nunca cacheamos métodos no-GET (mutaciones).
    if (request.method !== 'GET') return;

    // 3. Server actions Next.js (Action POST llega como GET en algunos casos
    //    rare; mejor no tocar /api/*). Tampoco cacheamos /api/* aunque sea GET.
    if (url.pathname.startsWith('/api/')) return;

    // 4. Assets fingerprinted Next.js (/_next/static/*) → cache-first inmutable.
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // 5. Iconos, fuentes, imágenes en /public → cache-first.
    if (
        url.pathname.startsWith('/icons/') ||
        url.pathname.startsWith('/brand/') ||
        url.pathname === '/manifest.json' ||
        /\.(png|jpg|jpeg|svg|webp|woff2?|ttf|otf)$/i.test(url.pathname)
    ) {
        event.respondWith(cacheFirst(request, RUNTIME_CACHE));
        return;
    }

    // 6. HTML (navegación):
    //    - /dashboard/* y /kitchen/* → SIEMPRE network. Nunca cacheamos HTML
    //      de áreas autenticadas para no filtrar UI de un usuario a otro
    //      en tablets compartidas. Si no hay red, fallback a /offline.
    //    - Resto (marketing público, /login, /offline) → network-first con
    //      cache fallback a sí mismo, y a /offline si nunca se vio.
    const accept = request.headers.get('accept') || '';
    if (request.mode === 'navigate' || accept.includes('text/html')) {
        if (isAuthenticatedRoute(url.pathname)) {
            event.respondWith(networkOnlyHtml(request));
        } else {
            event.respondWith(networkFirstHtml(request));
        }
        return;
    }

    // 7. El resto: network con cache fallback silencioso.
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

// ── ESTRATEGIAS ─────────────────────────────────────────────────────────────

function isAuthenticatedRoute(pathname) {
    return (
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/kitchen') ||
        pathname.startsWith('/maintenance')
    );
}

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (err) {
        // Sin red y sin cache → propaga el error (assets críticos).
        throw err;
    }
}

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw err;
    }
}

async function networkFirstHtml(request) {
    const cache = await caches.open(PAGES_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        // Sin red y sin cache → página offline pre-cacheada.
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
        throw err;
    }
}

async function networkOnlyHtml(request) {
    // Áreas autenticadas: nunca leemos del cache. Sin red → /offline.
    try {
        return await fetch(request);
    } catch (err) {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
        throw err;
    }
}
