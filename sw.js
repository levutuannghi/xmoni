// XMoni Service Worker - Offline caching
const CACHE_NAME = 'xmoni-v1';
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

// Install: cache core assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Google APIs: always network
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com')) {
        return;
    }

    // Assets: cache-first, fallback to network
    e.respondWith(
        caches.match(e.request).then((cached) => {
            return cached || fetch(e.request).then((response) => {
                // Cache new assets
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                }
                return response;
            });
        }).catch(() => {
            // Offline fallback
            if (e.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
