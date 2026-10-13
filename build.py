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

(pub / "sw.js").write_text("""// Önce ağ, olmazsa önbellek: çevrimdışıyken son görülen ekran açılır.
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
""", encoding="utf-8")

def icon(size, path):
    s = size * 4
    im = Image.new("RGBA", (s, s), (14, 90, 80, 255))
    d = ImageDraw.Draw(im)
    c = s / 2
    r = s * 0.30
    d.ellipse([c - r, c - r, c + r, c + r], outline=(250, 251, 249, 150), width=int(s * 0.025))
    d.polygon([(c, c - r * 1.1), (c + r * 0.34, c), (c, c + r * 1.1), (c - r * 0.34, c)], fill=(250, 251, 249, 70))
    d.polygon([(c, c - r * 1.1), (c + r * 0.34, c), (c - r * 0.34, c)], fill=(200, 115, 26, 255))
    im.resize((size, size), Image.LANCZOS).convert("RGB").save(path)

for n in (180, 192, 512):
    icon(n, pub / f"icon-{n}.png")
print("public/ hazır:", sorted(p.name for p in pub.iterdir()))
