// XMoni Service Worker - Network-first caching
const CACHE_NAME = 'xmoni-v5';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/utils.js',
    './js/auth.js',
    './js/drive.js',
    './js/budget.js',
    './js/expense.js',
    './js/dashboard.js',
    './js/app.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
];

// Install: cache core assets, skip waiting immediately
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean ALL old caches immediately
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network-first for app files, cache-first for external resources
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Skip Google APIs entirely (auth, Drive)
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com')) {
        return;
    }

    // Skip VietQR API
    if (url.hostname.includes('vietqr.io')) {
        return;
    }

    // Same-origin files: NETWORK-FIRST (always get latest)
    if (url.origin === self.location.origin) {
        e.respondWith(
            fetch(e.request)
                .then((response) => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    // Offline: serve from cache
                    return caches.match(e.request).then((cached) => {
                        if (cached) return cached;
                        if (e.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                    });
                })
        );
        return;
    }

    // External resources (fonts, CDNs): cache-first
    e.respondWith(
        caches.match(e.request).then((cached) => {
            return cached || fetch(e.request).then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                }
                return response;
            });
        })
    );
});
