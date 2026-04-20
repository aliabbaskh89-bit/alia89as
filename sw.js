const CACHE = 'ali-v3';
const STATIC = ['/', '/index.html', '/styles.css', '/script.js', '/profile.jpg'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Never intercept non-GET requests (uploads, API calls, etc.)
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);
    // Always fetch fresh for JS, CSS, HTML, and API
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.html') || url.pathname.startsWith('/api/')) {
        e.respondWith(fetch(e.request));
        return;
    }
    // Cache-first for images
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
