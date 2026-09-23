const CACHE_NAME = 'st-pauls-league-v2';
const PRECACHE_ASSETS = [
    '/',
    '/site.webmanifest',
    '/css/style.css',
    '/js/main.js',
    '/images/android-chrome-192x192.png',
    '/images/android-chrome-512x512.png',
    '/images/apple-touch-icon.png',
    '/images/favicon-32x32.png',
    '/images/favicon-16x16.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // Bypass caching for API, authentication, and admin endpoints
    if (
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/auth') ||
        url.pathname.startsWith('/admin')
    ) {
        return;
    }

    // Navigation requests (HTML pages): Network-first with cache fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return caches.match('/');
                })
        );
        return;
    }

    // Static assets (CSS, JS, images, fonts): Cache-first with network fallback
    if (
        url.pathname.startsWith('/css/') ||
        url.pathname.startsWith('/js/') ||
        url.pathname.startsWith('/images/') ||
        url.pathname === '/site.webmanifest'
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Update cache in the background
                    fetch(request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
                            }
                        })
                        .catch(() => {});
                    return cachedResponse;
                }

                return fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                });
            })
        );
    }
});
