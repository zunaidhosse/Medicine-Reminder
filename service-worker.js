const CACHE_NAME = 'med-reminder-cache-v1';
const urlsToCache = [
    '.',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'app-icon-192.png',
    'app-icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap',
    'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2' // Cache woff2 font file
];

// Install event
self.addEventListener('install', event => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Caching app shell');
                // Use addAll for atomic cache, but be careful as one failure fails all
                // Using individual add requests is safer but more verbose
                const cachePromises = urlsToCache.map(urlToCache => {
                    return cache.add(new Request(urlToCache, {mode: 'cors'}))
                        .catch(err => {
                            console.warn(`[ServiceWorker] Failed to cache ${urlToCache}:`, err);
                        });
                });
                return Promise.all(cachePromises);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event (Cache-first, fallback to network)
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    // console.log('[ServiceWorker] Serving from cache:', event.request.url);
                    return response;
                }

                // console.log('[ServiceWorker] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then(networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            // Don't cache opaque responses (e.g., from CDNs without CORS) unless necessary
                            if(networkResponse.type === 'opaque') {
                                // Cache opaque responses (like Google Fonts)
                            } else {
                                return networkResponse;
                            }
                        }

                        // Clone the response
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // console.log('[ServiceWorker] Caching new resource:', event.request.url);
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(error => {
                        console.log('[ServiceWorker] Fetch failed:', error);
                        // Optional: Return a custom offline fallback page
                    });
            })
    );
});

// Handle notifications
self.addEventListener('notificationclick', event => {
    console.log('[ServiceWorker] Notification click received.');
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});

