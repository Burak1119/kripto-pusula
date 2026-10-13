// Önce ağ, olmazsa önbellek: çevrimdışıyken son görülen ekran açılır.
const NAME = 'kripto-pusula-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(NAME).then((c) => c.addAll(['/']))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => (ws.length ? ws[0].focus() : self.clients.openWindow('/'))));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && !url.pathname.startsWith('/api/')) { const copy = r.clone(); caches.open(NAME).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match('/'))));
});
