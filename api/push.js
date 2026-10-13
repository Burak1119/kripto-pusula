// Bildirim aboneliği: kaydet, kapat, gelen kutusu, deneme. Portföy MİKTARLARI ve maliyetleri sunucuya gönderilmez;
// yalnızca izlenen varlıkların adı/kimliği ve fiyat alarmları saklanır.
const store = require('./_store');
const push = require('./_push');
const MAX_SUBS = 300;
const str = (v, n) => String(v === undefined || v === null ? '' : v).slice(0, n);
const cleanWatch = (l) => (Array.isArray(l) ? l : []).slice(0, 60).map((w) => ({ k: w && w.k === 's' ? 's' : 'c', id: str(w && w.id, 80), sym: str(w && w.sym, 15), name: str(w && w.name, 60) })).filter((w) => w.id);
const cleanAlerts = (l) => (Array.isArray(l) ? l : []).slice(0, 40).map((a) => ({
  u: str(a && a.u, 30), k: a && a.k === 's' ? 's' : 'c', id: str(a && a.id, 80), sym: str(a && a.sym, 15), name: str(a && a.name, 60),
  dir: a && a.dir === 'dn' ? 'dn' : 'up', price: Number(a && a.price), ccy: ['TRY', 'USD', 'EUR'].includes(a && a.ccy) ? a.ccy : 'TRY', done: a && Number(a.done) > 0 ? Number(a.done) : null,
})).filter((a) => a.u && a.id && Number.isFinite(a.price) && a.price > 0);
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  let s = '';
  for await (const c of req) { s += c; if (s.length > 60000) throw new Error('büyük'); }
  try { return JSON.parse(s || '{}'); } catch (e) { return {}; }
}
module.exports = async function handler(req, res) {
  const u = new URL(req.url, 'http://x'), a = u.searchParams.get('a') || 'status';
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  const out = (o, code) => { res.statusCode = code || 200; res.end(JSON.stringify(o)); };
  const ready = store.configured() && push.configured();
  if (a === 'status') return out({ ready, store: store.configured(), vapid: push.configured(), key: ready ? push.pub() : null });
  if (req.method !== 'POST') return out({ error: 'POST gerekir' }, 405);
  if (!ready) return out({ error: 'Sunucu kurulumu tamamlanmamış' }, 503);
  let b; try { b = await body(req); } catch (e) { return out({ error: 'Bozuk istek' }, 400); }
  const endpoint = str((b.sub && b.sub.endpoint) || b.endpoint, 600);
  if (!push.okEndpoint(endpoint)) return out({ error: 'Geçersiz abonelik' }, 400);
  const id = push.idOf(endpoint);
  try {
    if (a === 'sync') {
      const keys = b.sub && b.sub.keys;
      const old = await store.getJson('sub:' + id);
      if (!old && (await store.scard('subs')) >= MAX_SUBS) return out({ error: 'Abone sınırı doldu' }, 429);
      const alerts = cleanAlerts(b.alerts), prev = new Map(((old && old.alerts) || []).map((x) => [x.u, x]));
      // Sunucuda tetiklenmiş alarm, kullanıcı fiyatını değiştirmediyse tetiklenmiş kalır
      for (const x of alerts) { const p = prev.get(x.u); if (p && p.done && p.price === x.price && p.dir === x.dir) x.done = p.done; }
      const rec = { endpoint, keys: keys && typeof keys === 'object' ? { p256dh: str(keys.p256dh, 200), auth: str(keys.auth, 100) } : null, watch: cleanWatch(b.watch), alerts,
        sigs: (old && old.sigs) || {}, done: (old && old.done) || {}, at: (old && old.at) || Date.now() };
      await store.setJson('sub:' + id, rec); await store.sadd('subs', id);
      return out({ ok: true, alerts: alerts.map((x) => ({ u: x.u, done: x.done })) });
    }
    if (a === 'off') { await store.del('sub:' + id); await store.srem('subs', id); await store.del('msg:' + id); return out({ ok: true }); }
    if (a === 'inbox') {
      const msgs = await store.lall('msg:' + id); if (msgs.length) await store.del('msg:' + id);
      return out({ msgs: msgs.slice(-5) });
    }
    if (a === 'test') {
      if (!(await store.getJson('sub:' + id))) return out({ error: 'Önce bildirimleri aç' }, 400);
      await store.rpush('msg:' + id, { title: 'Deneme bildirimi', body: 'Bu mesaj sunucudan geldi. Uygulama kapalıyken de böyle haber vereceğim.', tag: 'test' }); await store.expire('msg:' + id, 259200);
      const r = await push.send(endpoint, req.headers && req.headers.host);
      if (r.gone) { await store.del('sub:' + id); await store.srem('subs', id); }
      return out({ ok: r.ok, status: r.status });
    }
    return out({ error: 'Bilinmeyen işlem' }, 400);
  } catch (e) { return out({ error: String(e.message || e) }, 502); }
};
