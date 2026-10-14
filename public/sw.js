// Önce ağ, olmazsa önbellek: çevrimdışıyken son görülen ekran açılır.
const NAME = 'kripto-pusula-v5';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(NAME).then((c) => c.addAll(['/']))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Sunucudan gelen boş "dürtme": asıl bildirim metnini sunucudan alıp gösterir (iPhone her dürtmede bildirim gösterilmesini şart koşar).
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let msgs = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch('/api/push?a=inbox', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        msgs = ((await r.json()).msgs || []).filter((m) => m && m.title);
      }
    } catch (err) { /* ağ yoksa genel mesaj gösterilir */ }
    if (!msgs.length) msgs = [{ title: 'Kripto Pusula', body: 'Elindeki varlıklarla ilgili yeni bir gelişme var. Ayrıntı için uygulamayı aç.' }];
    for (const m of msgs.slice(0, 5)) await self.registration.showNotification(m.title, { body: m.body || '', tag: m.tag || undefined, icon: '/icon-192.png', data: { k: m.k || '', id: m.id || '' } });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {}, open = d.id && (d.k === 'c' || d.k === 's') ? { k: d.k, id: d.id } : null;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    if (ws.length) { const w = ws[0]; if (open) w.postMessage({ open }); return w.focus(); }
    return self.clients.openWindow(open ? '/?open=' + open.k + ':' + encodeURIComponent(open.id) : '/');
  }));
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
