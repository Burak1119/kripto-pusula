// Haber başlıklarını Türkçeye çevirir. Resmî olmayan, anahtarsız çeviri uç noktaları kullanılır; çalışmazsa
// başlıklar orijinal kalır (uygulama bozulmaz). Aynı başlık tekrar çevrilmez.
const cache = new Map();
async function viaGoogle(t) {
  const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=' + encodeURIComponent(t), { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('g' + r.status);
  const j = await r.json();
  const s = (j[0] || []).map((x) => x && x[0] || '').join('').trim();
  if (!s) throw new Error('boş');
  return s;
}
async function viaMyMemory(t) {
  const r = await fetch('https://api.mymemory.translated.net/get?langpair=en|tr&q=' + encodeURIComponent(t), { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('m' + r.status);
  const j = await r.json(), s = String((j.responseData && j.responseData.translatedText) || '').trim();
  if (!s || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(s) || j.responseStatus !== 200) throw new Error('mm');
  return s;
}
async function one(t) {
  if (cache.has(t)) return cache.get(t);
  let s = null;
  try { s = await viaGoogle(t); } catch (e) { try { s = await viaMyMemory(t); } catch (e2) { s = null; } }
  if (s) { if (cache.size > 3000) cache.delete(cache.keys().next().value); cache.set(t, s); }
  return s;
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  let s = ''; for await (const c of req) { s += c; if (s.length > 40000) break; }
  try { return JSON.parse(s || '{}'); } catch (e) { return {}; }
}
module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }
  const b = await body(req), list = (Array.isArray(b.titles) ? b.titles : []).slice(0, 40).map((t) => String(t || '').slice(0, 240));
  const out = new Array(list.length).fill(null);
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < list.length) { const k = i++; if (list[k]) out[k] = await one(list[k]); } }));
  res.end(JSON.stringify({ t: out }));
};
module.exports._cache = cache;
