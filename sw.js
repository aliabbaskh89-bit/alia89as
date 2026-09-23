const CACHE = 'ali-v22';
const STATIC = ['/', '/index.html', '/styles-v21.css', '/platform.css?v=28', '/script.js?v=21', '/profile.jpg', '/logocopy.png', '/pwa-install.css?v=1', '/pwa-install.js?v=1'];

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

    // CRITICAL: Never intercept video streaming — let browser handle Range requests directly
    if (url.pathname.startsWith('/api/video/')) return;

    // Always fetch fresh for root navigation (/), HTML, JS, CSS, and API
    if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.js') || 
        url.pathname.endsWith('.css') || url.pathname.endsWith('.html') || url.pathname.startsWith('/api/')) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
        return;
    }
    // Cache-first for images and other static assets
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
