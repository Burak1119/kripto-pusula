// Cihazlar arası eşitleme: portföy cihazda şifrelenir, burada yalnızca okunamayan hâli (ve son değişiklik zamanı) saklanır.
// Anahtar eşitleme kodundan cihazda türetilir; sunucu kodu da anahtarı da görmez. POST /api/sync?a=get|put  { id, at, blob }
const store = require('./_store');
const TTL = 400 * 86400;
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  let s = '';
  for await (const c of req) { s += c; if (s.length > 220000) throw new Error('büyük'); }
  try { return JSON.parse(s || '{}'); } catch (e) { return {}; }
}
module.exports = async function handler(req, res) {
  const u = new URL(req.url, 'http://x'), a = u.searchParams.get('a');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  const out = (o, code) => { res.statusCode = code || 200; res.end(JSON.stringify(o)); };
  if (req.method !== 'POST') return out({ error: 'POST gerekir' }, 405);
  if (!store.configured()) return out({ error: 'Sunucu deposu kurulmamış' }, 503);
  let b; try { b = await body(req); } catch (e) { return out({ error: 'Kayıt çok büyük' }, 413); }
  const id = String(b.id || '');
  if (!/^[0-9a-f]{64}$/.test(id)) return out({ error: 'Geçersiz kimlik' }, 400);
  const key = 'sync:' + id;
  try {
    if (a === 'get') {
      const r = await store.getJson(key);
      if (!r) return out({ none: true });
      await store.expire(key, TTL);
      return out({ at: r.at, blob: r.blob });
    }
    if (a === 'put') {
      const at = Number(b.at), blob = String(b.blob || '');
      if (!Number.isFinite(at) || at <= 0 || !blob || blob.length > 200000 || !/^[A-Za-z0-9_-]+$/.test(blob)) return out({ error: 'Bozuk kayıt' }, 400);
      const old = await store.getJson(key);
      if (old && old.at > at) return out({ ok: false, newer: true, at: old.at });
      await store.setJson(key, { at, blob }, TTL);
      return out({ ok: true, at });
    }
    return out({ error: 'Bilinmeyen işlem' }, 400);
  } catch (e) { return out({ error: 'Depoya ulaşılamadı' }, 502); }
};
