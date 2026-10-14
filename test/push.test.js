// Bildirim sunucusu: VAPID imzası, abonelik, kontrol (cron), gelen kutusu, deneme, çeviri. Sahte Redis ve sahte push servisiyle.
const http = require('http'), crypto = require('crypto'), path = require('path');
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('HATA:', m); } else console.log('ok  ', m); };
const listen = (h) => new Promise((r) => { const s = http.createServer(h).listen(0, '127.0.0.1', () => r(s)); });
const reqOf = (url, method, body) => ({ url, method, headers: { host: 'site.test' }, body });
const call = (fn, url, method, body) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, end(s) { resolve({ code: this.statusCode, json: s ? JSON.parse(s) : null }); } };
  Promise.resolve(fn(reqOf(url, method || 'GET', body), res)).catch(reject);
});
(async () => {
  // ---- sahte Redis (Upstash REST) ----
  const db = new Map(), sets = new Map(), lists = new Map();
  const redis = await listen((req, res) => {
    let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => {
      const [c, k, ...a] = JSON.parse(s); let r = null;
      if (req.headers.authorization !== 'Bearer tok') { res.statusCode = 401; return res.end('{"error":"yetkisiz"}'); }
      if (c === 'GET') r = db.get(k) ?? null;
      else if (c === 'SET') { db.set(k, a[0]); r = 'OK'; }
      else if (c === 'DEL') { r = db.delete(k) | lists.delete(k) ? 1 : 0; }
      else if (c === 'SADD') { (sets.get(k) || sets.set(k, new Set()).get(k)).add(a[0]); r = 1; }
      else if (c === 'SREM') { (sets.get(k) || new Set()).delete(a[0]); r = 1; }
      else if (c === 'SMEMBERS') r = [...(sets.get(k) || [])];
      else if (c === 'SCARD') r = (sets.get(k) || new Set()).size;
      else if (c === 'MGET') r = [k, ...a].map((x) => db.get(x) ?? null);
      else if (c === 'RPUSH') { (lists.get(k) || lists.set(k, []).get(k)).push(a[0]); r = 1; }
      else if (c === 'LTRIM') { const l = lists.get(k) || []; lists.set(k, l.slice(Number(a[0]) < 0 ? Math.max(0, l.length + Number(a[0])) : Number(a[0]))); r = 'OK'; }
      else if (c === 'EXPIRE') r = 1;
      else if (c === 'LRANGE') r = (lists.get(k) || []).slice();
      res.end(JSON.stringify({ result: r }));
    });
  });
  // ---- sahte push servisi ----
  const pushes = [];
  const svc = await listen((req, res) => { pushes.push({ url: req.url, headers: req.headers, method: req.method }); res.statusCode = req.url.startsWith('/gone') ? 410 : 201; res.end(); });
  const base = 'http://127.0.0.1:' + svc.address().port;

  const P = require('../api/_push');
  const keys = P.generate();
  ok(Buffer.from(keys.VAPID_PUBLIC, 'base64url').length === 65 && Buffer.from(keys.VAPID_PRIVATE, 'base64url').length === 32, 'VAPID anahtarı doğru boyda üretildi');
  Object.assign(process.env, keys, { KV_REST_API_URL: 'http://127.0.0.1:' + redis.address().port, KV_REST_API_TOKEN: 'tok', PUSH_ALLOW_LOCAL: '1', CRON_KEY: 'gizli' });
  ok(P.configured(), 'anahtarlar tanımlıyken hazır');
  // JWT imzası herkese açık anahtarla doğrulanabiliyor mu
  const t = P.jwt('https://fcm.googleapis.com', 'https://site.test').split('.');
  const pubBuf = Buffer.from(keys.VAPID_PUBLIC, 'base64url');
  const pk = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pubBuf.subarray(1, 33).toString('base64url'), y: pubBuf.subarray(33).toString('base64url') }, format: 'jwk' });
  ok(crypto.verify('sha256', Buffer.from(t[0] + '.' + t[1]), { key: pk, dsaEncoding: 'ieee-p1363' }, Buffer.from(t[2], 'base64url')), 'VAPID imzası doğrulanıyor (ES256)');
  const claims = JSON.parse(Buffer.from(t[1], 'base64url').toString());
  ok(claims.aud === 'https://fcm.googleapis.com' && claims.exp > Date.now() / 1000 && claims.exp < Date.now() / 1000 + 86400, 'JWT hedef ve süre doğru (24 saatten kısa)');
  delete process.env.PUSH_ALLOW_LOCAL;
  ok(P.okEndpoint('https://fcm.googleapis.com/fcm/send/abc') && P.okEndpoint('https://web.push.apple.com/Qx') && P.okEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x') && P.okEndpoint('https://wns2-par02p.notify.windows.com/w/?token=1'), 'bilinen push servisleri kabul');
  ok(!P.okEndpoint('https://evil.example.com/x') && !P.okEndpoint('http://fcm.googleapis.com/x') && !P.okEndpoint('https://fcm.googleapis.com.evil.com/x') && !P.okEndpoint('https://127.0.0.1/x') && !P.okEndpoint('javascript:1'), 'rastgele adrese gönderim engelleniyor');
  process.env.PUSH_ALLOW_LOCAL = '1';

  // ---- push.js ----
  const pushApi = require('../api/push');
  let r = await call(pushApi, '/api/push?a=status');
  ok(r.json.ready && r.json.key === keys.VAPID_PUBLIC && !('VAPID_PRIVATE' in r.json), 'durum: hazır ve yalnızca herkese açık anahtar dönüyor');
  r = await call(pushApi, '/api/push?a=sync', 'GET');
  ok(r.code === 405, 'sync yalnızca POST');
  const endpoint = base + '/ok/abcdef';
  const sub = { endpoint, keys: { p256dh: 'p', auth: 'a' } };
  r = await call(pushApi, '/api/push?a=sync', 'POST', { sub: { endpoint: 'https://evil.example.com/x' }, watch: [] });
  ok(r.code === 400, 'geçersiz abonelik adresi reddedilir');
  const watch = [{ k: 'c', id: 'bitcoin', sym: 'btc', name: 'Bitcoin' }, { k: 'c', id: 'xyz', sym: 'xyz', name: 'Düşen Coin' }, { k: 's', id: 'bist:THYAO', sym: 'THYAO', name: 'Türk Hava Yolları' }, { k: 'x', id: '' }];
  const alerts = [
    { u: 'a1', k: 'c', id: 'bitcoin', sym: 'btc', name: 'Bitcoin', dir: 'up', price: 4000000, ccy: 'TRY' },
    { u: 'a2', k: 's', id: 'bist:THYAO', sym: 'THYAO', name: 'Türk Hava Yolları', dir: 'dn', price: 100, ccy: 'TRY' },
    { u: 'a3', k: 'c', id: 'bitcoin', sym: 'btc', name: 'Bitcoin', dir: 'up', price: 9e9, ccy: 'USD' },
    { u: 'bad', k: 'c', id: 'bitcoin', dir: 'up', price: -5, ccy: 'TRY' }];
  r = await call(pushApi, '/api/push?a=sync', 'POST', { sub, watch, alerts });
  ok(r.json.ok && r.json.alerts.length === 3, 'sync: kayıt oldu, bozuk alarm ve bozuk izleme satırı elendi');
  const id = P.idOf(endpoint), rec0 = JSON.parse(db.get('kp:sub:' + id));
  ok(rec0.watch.length === 3 && !JSON.stringify(rec0).includes('qty') && !JSON.stringify(rec0).includes('cost'), 'sunucuda miktar/maliyet yok, yalnızca izleme listesi');
  rec0.sigs = { bitcoin: 'BEKLE', xyz: 'AL', 'bist:THYAO': 'BEKLE' }; db.set('kp:sub:' + id, JSON.stringify(rec0));

  // ---- cron.js: veri kaynaklarını sahtele ----
  const stocksReal = require('../api/stocks'), meta = stocksReal.meta();
  const stub = (p, fn) => { const f = require.resolve(p); require.cache[f] = { id: f, filename: f, loaded: true, exports: fn }; };
  const walk = (end, n, drift) => { const a = []; for (let i = 0; i < n; i++) a.push(end * (1 - drift * (n - 1 - i) / n)); return a; };
  const coinsDb = {
    bitcoin: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', price: 4100000, mcap: 8e13, vol: 1e12, rank: 1, c24: 1, c7: 3, c30: 5, ath: -10, spark: walk(4100000, 85, -0.03) },
    xyz: { id: 'xyz', symbol: 'xyz', name: 'Düşen Coin', price: 10, mcap: 5e9, vol: 2e8, rank: 60, c24: -12, c7: -30, c30: -45, ath: -80, spark: walk(10, 85, 0.5) },
  };
  stub('../api/coins', async (req, res) => {
    const u = new URL(req.url, 'http://x'), vs = u.searchParams.get('vs'), f = vs === 'usd' ? 1 / 40 : 1;
    const coins = u.searchParams.getAll('c').map((x) => x.split('|')[0]).filter((x) => coinsDb[x]).map((x) => ({ ...coinsDb[x], price: coinsDb[x].price * f, req: x }));
    res.end(JSON.stringify({ updated: Date.now(), vs, coins }));
  });
  stub('../api/news', async (req, res) => res.end(JSON.stringify({ updated: Date.now(), news: [] })));
  const raw = { updated: Date.now(), meta, us: {}, bist: { THYAO: { p: 95, c: 0.5 } }, eu: {}, hist: { us: {}, bist: { THYAO: walk(95, 126, 0.1) }, eu: {} }, ok: { midas: true, hist: true } };
  stub('../api/stocks', Object.assign(async (req, res) => res.end(JSON.stringify(raw)), { meta: stocksReal.meta }));
  delete require.cache[require.resolve('../api/cron')];
  const cron = require('../api/cron');
  r = await call(cron, '/api/cron?key=yanlis');
  ok(r.code === 401, 'cron: yanlış anahtarla çalışmaz');
  r = await call(cron, '/api/cron?key=gizli');
  ok(r.json.ok && r.json.subs === 1 && r.json.sent === 1, 'cron: 1 abone kontrol edildi, 1 bildirim gönderildi ' + JSON.stringify(r.json));
  ok(pushes.length === 1 && pushes[0].url === '/ok/abcdef' && pushes[0].method === 'POST' && /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(pushes[0].headers.authorization) && pushes[0].headers.ttl === '86400', 'push servisine imzalı, içeriksiz istek gitti');
  r = await call(pushApi, '/api/push?a=inbox', 'POST', { endpoint });
  const titles = r.json.msgs.map((m) => m.title);
  console.log('   gelen kutusu:', titles.join(' | '));
  ok(titles.some((x) => /Bitcoin: hedef fiyata ulaştı/.test(x)), 'bitcoin fiyat alarmı (TL) çaldı');
  ok(titles.some((x) => /Türk Hava Yolları: hedef fiyata ulaştı/.test(x)), 'hisse fiyat alarmı çaldı');
  ok(titles.filter((x) => /hedef fiyata/.test(x)).length === 2, 'yalnızca ulaşılan 2 alarm çaldı');
  ok(titles.some((x) => /Düşen Coin: sinyal (SAT|AZALT)/.test(x)), 'sinyali AL → kötüleşen coin için uyarı geldi');
  ok(titles.some((x) => /Düşen Coin bugün −12,0%/.test(x)), 'günde %12 düşen coin için sert hareket uyarısı geldi');
  r = await call(pushApi, '/api/push?a=inbox', 'POST', { endpoint });
  ok(r.json.msgs.length === 0, 'gelen kutusu okununca boşalır');
  const rec1 = JSON.parse(db.get('kp:sub:' + id));
  ok(rec1.alerts.find((a) => a.u === 'a1').done > 0 && !rec1.alerts.find((a) => a.u === 'a3').done && rec1.sigs.xyz, 'sunucu çalan alarmı ve son sinyalleri kaydetti');
  // yeniden kontrol: tekrar bildirim yok
  const cronMod = require.resolve('../api/cron'); delete require.cache[cronMod]; const cron2 = require('../api/cron');
  const before = pushes.length;
  r = await call(cron2, '/api/cron?key=gizli');
  ok(r.json.sent === 0 && pushes.length === before, 'ikinci kontrolde aynı olaylar için tekrar bildirim gitmedi');
  // istemci yeniden sync: çalmış alarm çalmış kalır, fiyatı değişen yeniden kurulur
  r = await call(pushApi, '/api/push?a=sync', 'POST', { sub, watch, alerts: [alerts[0], { ...alerts[1], price: 90 }] });
  ok(r.json.alerts.find((a) => a.u === 'a1').done > 0 && r.json.alerts.find((a) => a.u === 'a2').done === null, 'sync: çalmış alarm korunur, fiyatı değişen alarm yeniden kurulur');
  // deneme bildirimi
  r = await call(pushApi, '/api/push?a=test', 'POST', { endpoint });
  ok(r.json.ok && pushes.length === before + 1, 'deneme bildirimi gönderildi');
  r = await call(pushApi, '/api/push?a=inbox', 'POST', { endpoint });
  ok(r.json.msgs.length === 1 && r.json.msgs[0].title === 'Deneme bildirimi', 'deneme mesajı gelen kutusunda');
  // ---- sabah özeti, altın/döviz alarmı, otomatik kural alarmı ----
  stub('../api/fx', async (req, res) => res.end(JSON.stringify({ updated: Date.now(), TRY: 1, USD: 41, EUR: 47, gold: { usdOz: 2700, chg: 0.5 } })));
  const ep2 = base + '/ok/morning1', sub2 = { endpoint: ep2, keys: { p256dh: 'p', auth: 'a' } }, id2 = P.idOf(ep2);
  const alerts2 = [
    { u: 'f1', k: 'f', id: 'fx:usd', sym: 'USD', name: 'Amerikan doları', dir: 'up', price: 40, ccy: 'TRY' },
    { u: 'f2', k: 'f', id: 'fx:gold', sym: 'gram', name: 'Gram altın', dir: 'up', price: 99999, ccy: 'TRY' },
    { u: 'rb1l', k: 'c', id: 'bitcoin', sym: 'btc', name: 'Bitcoin', dir: 'dn', price: 5000000, ccy: 'TRY', n: 'maliyetinin %10 altına indi' }];
  r = await call(pushApi, '/api/push?a=sync', 'POST', { sub: sub2, watch: [watch[0], watch[1]], alerts: alerts2, morning: 9 });
  ok(r.json.ok && JSON.parse(db.get('kp:sub:' + id2)).morning === 9, 'sync: sabah özeti saati ve döviz alarmı kaydedildi');
  r = await call(pushApi, '/api/push?a=sync', 'POST', { sub: { endpoint: base + '/ok/morning2', keys: {} }, watch: [], alerts: [], morning: 99 });
  ok(JSON.parse(db.get('kp:sub:' + P.idOf(base + '/ok/morning2'))).morning === null, 'geçersiz sabah saati yok sayılır');
  await call(pushApi, '/api/push?a=off', 'POST', { endpoint: base + '/ok/morning2' });
  const realNow = Date.now, fixed = Date.UTC(2026, 9, 14, 6, 30); // İstanbul 09:30
  Date.now = () => fixed;
  delete require.cache[cronMod]; const cron4 = require('../api/cron');
  r = await call(cron4, '/api/cron?key=gizli');
  Date.now = realNow;
  r = await call(pushApi, '/api/push?a=inbox', 'POST', { endpoint: ep2 });
  const t2 = r.json.msgs.map((m) => m.title + ' // ' + m.body);
  console.log('   sabah kutusu:', t2.join(' | '));
  ok(t2.some((x) => /^Günaydın, piyasa özeti/.test(x) && /Dolar ₺41,00/.test(x) && /Gram altın/.test(x) && /Düşen Coin/.test(x)), 'sabah özeti geldi: hareketler, dolar ve gram altın');
  ok(t2.some((x) => /Amerikan doları: hedef fiyata ulaştı/.test(x)), 'dolar alarmı çaldı');
  ok(!t2.some((x) => /Gram altın: hedef/.test(x)), 'ulaşılmayan altın alarmı çalmadı');
  ok(t2.some((x) => /Bitcoin: maliyetinin %10 altına indi/.test(x)), 'otomatik kural alarmı kendi notuyla çaldı');
  ok(JSON.parse(db.get('kp:sub:' + id2)).done.morning === '2026-10-14', 'sabah özetinin günü kaydedildi');
  Date.now = () => fixed + 20 * 60e3;
  delete require.cache[cronMod]; const cron5 = require('../api/cron');
  await call(cron5, '/api/cron?key=gizli');
  Date.now = realNow;
  r = await call(pushApi, '/api/push?a=inbox', 'POST', { endpoint: ep2 });
  ok(!r.json.msgs.some((m) => /Günaydın/.test(m.title)), 'aynı gün ikinci kez sabah özeti gitmedi');
  await call(pushApi, '/api/push?a=off', 'POST', { endpoint: ep2 });
  // geçersiz (silinmiş) abonelik temizlenir
  const gone = base + '/gone/zzz';
  await call(pushApi, '/api/push?a=sync', 'POST', { sub: { endpoint: gone }, watch: [{ k: 'c', id: 'bitcoin', sym: 'btc', name: 'Bitcoin' }], alerts: [{ u: 'g1', k: 'c', id: 'bitcoin', sym: 'btc', name: 'Bitcoin', dir: 'up', price: 1, ccy: 'TRY' }] });
  delete require.cache[cronMod]; const cron3 = require('../api/cron');
  r = await call(cron3, '/api/cron?key=gizli');
  ok(r.json.gone === 1 && !db.has('kp:sub:' + P.idOf(gone)), '410 dönen abonelik silindi');
  r = await call(pushApi, '/api/push?a=off', 'POST', { endpoint });
  ok(r.json.ok && !db.has('kp:sub:' + id) && !(sets.get('kp:subs') || new Set()).has(id), 'bildirimleri kapatınca kayıt silinir');
  delete process.env.VAPID_PRIVATE;
  r = await call(pushApi, '/api/push?a=status');
  ok(!r.json.ready && r.json.key === null, 'anahtar yoksa durum "hazır değil"');
  r = await call(cron, '/api/cron?key=gizli');
  ok(r.code === 503 || r.json.skipped, 'anahtar yokken cron güvenle durur');

  // ---- çeviri ----
  const tr = require('../api/translate');
  const realFetch = global.fetch; let calls = 0;
  global.fetch = async (u) => { calls++; if (u.includes('translate.googleapis.com')) { const q = decodeURIComponent(u.split('&q=')[1]); return { ok: true, json: async () => [[['ÇEVRİLDİ: ' + q, q, null, null, 1]], null, 'en'] }; } return { ok: false, status: 500 }; };
  r = await call(tr, '/api/translate', 'POST', { titles: ['Bitcoin surges', 'Ether falls', '', 'Bitcoin surges'] });
  ok(r.json.t[0] === 'ÇEVRİLDİ: Bitcoin surges' && r.json.t[1] === 'ÇEVRİLDİ: Ether falls' && r.json.t[2] === null && r.json.t[3] === r.json.t[0], 'çeviri sırası korunur, boş başlık atlanır');
  const c0 = calls; await call(tr, '/api/translate', 'POST', { titles: ['Bitcoin surges'] });
  ok(calls === c0, 'aynı başlık önbellekten gelir, tekrar çevrilmez');
  global.fetch = async () => ({ ok: false, status: 503 });
  r = await call(tr, '/api/translate', 'POST', { titles: ['Yeni başlık one'] });
  ok(r.code === 200 && r.json.t[0] === null, 'çeviri servisi çalışmazsa null döner (uygulama orijinali gösterir)');
  global.fetch = realFetch;
  r = await call(tr, '/api/translate', 'GET'); ok(r.code === 405, 'çeviri yalnızca POST');
  redis.close(); svc.close();
  console.log(fail ? fail + ' hata' : 'Tüm bildirim sunucusu testleri geçti');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
