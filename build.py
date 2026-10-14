"""src/app.html dosyasını tam bir web sayfasına (public/index.html) çevirir,
PWA dosyalarını (manifest, service worker, ikonlar) üretir."""
import re, json, pathlib
from PIL import Image, ImageDraw

root = pathlib.Path(__file__).parent
src = (root / "src" / "app.html").read_text(encoding="utf-8")
pub = root / "public"
pub.mkdir(exist_ok=True)

# Baştaki <title>, <link> ve <style> bloklarını head'e, kalanı body'ye koy
head_parts, rest = [], src
for pat in (r"<title>.*?</title>", r"<link[^>]*>", r"<style>.*?</style>"):
    for m in re.finditer(pat, rest, flags=re.S):
        head_parts.append(m.group(0))
    rest = re.sub(pat, "", rest, flags=re.S)

reset = ("<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px)}"
         "body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>")
# reset, uygulamanın kendi stilinden önce gelmeli
title = [p for p in head_parts if p.startswith("<title>")]
links = [p for p in head_parts if p.startswith("<link")]
styles = [p for p in head_parts if p.startswith("<style>")]

page = f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e5a50">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kripto Pusula">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-180.png">
{''.join(title)}
{reset}
{chr(10).join(links)}
{chr(10).join(styles)}
</head>
<body>
{rest.strip()}
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){{}});</script>
</body>
</html>
"""
(pub / "index.html").write_text(page, encoding="utf-8")

(pub / "manifest.webmanifest").write_text(json.dumps({
    "name": "Kripto Pusula", "short_name": "Pusula", "lang": "tr",
    "start_url": "/", "display": "standalone",
    "background_color": "#0d1514", "theme_color": "#0e5a50",
    "icons": [
        {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}, ensure_ascii=False, indent=2), encoding="utf-8")


# Sunucu tarafı (bildirim kontrolü) aynı analiz motorunu kullanır: uygulama dosyasından çıkarılır.
eng = src.split("// ENGINE START")[1].split("// ENGINE END")[0]
names = "analyze, newsContext, buildStockWorld, watchMessages, alertsRun, alertHit, fmtMoney, SIG_RANK, num"
(root / "api" / "_engine.js").write_text(
    "// Otomatik üretilir: python3 build.py (kaynak: src/app.html). Elle değiştirme.\n"
    "module.exports = new Function(" + json.dumps(eng + "\n;return { " + names + " };", ensure_ascii=False) + ")();\n",
    encoding="utf-8")

(pub / "sw.js").write_text("""// Önce ağ, olmazsa önbellek: çevrimdışıyken son görülen ekran açılır.
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
""", encoding="utf-8")

def icon(size, path):
    s = size * 4
    u = s / 100
    im = Image.new("RGBA", (s, s))
    px = im.load()
    for y in range(s):
        t = y / s
        col = (int(12 - 4 * t), int(70 - 22 * t), int(66 - 16 * t), 255)
        for x in range(s):
            px[x, y] = col
    d = ImageDraw.Draw(im)
    def line(pts, w, col):
        P = [(x * u, y * u) for x, y in pts]
        d.line(P, fill=col, width=int(w * u), joint="curve")
        for x, y in P:
            r = w * u / 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    c, r = 50 * u, 34 * u
    d.ellipse([c - r, c - r, c + r, c + r], outline=(46, 196, 160, 255), width=int(4 * u))
    line([(32, 66), (48, 46), (56, 56), (72, 32)], 6, (255, 255, 255, 255))
    line([(62, 31), (73, 31), (73, 42)], 6, (245, 166, 35, 255))
    im.resize((size, size), Image.LANCZOS).convert("RGB").save(path)

for n in (180, 192, 512):
    icon(n, pub / f"icon-{n}.png")
print("public/ hazır:", sorted(p.name for p in pub.iterdir()))
