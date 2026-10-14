// Harem Altın'ın herkese açık fiyat tablosundan altın alış/satış fiyatları (TL). Tek bir yerden, kısa önbellekle okunur;
// alınamazsa ya da veri uç değerliyse null döner ve uygulama kendi hesabına geri düşer.
// Teşhis: /api/harem?debug=1 → ham yanıtın başı ve ayrıştırma sonucu.
const URLS = ['https://www.haremaltin.com/dashboard/ajax/doviz', 'https://canlipiyasalar.haremaltin.com/tmp/altin.json?dil_kodu=tr'];
const HEAD = { 'user-agent': 'Mozilla/5.0 (compatible; KriptoPusula/1.0; kisisel kullanim)', accept: 'application/json, text/plain, */*', 'x-requested-with': 'XMLHttpRequest', referer: 'https://www.haremaltin.com/', origin: 'https://www.haremaltin.com' };
// Uygulamadaki kalem → sitedeki olası kodlar (ilk bulunan alınır)
const MAP = {
  'fx:gold': ['KULCEALTIN', 'GRAMALTIN', 'GRAM', 'ALTIN'], 'fx:22': ['AYAR22', '22AYAR'], 'fx:14': ['AYAR14', '14AYAR'],
  'fx:ceyrek': ['CEYREK_YENI', 'YENICEYREK', 'CEYREK'], 'fx:yarim': ['YARIM_YENI', 'YENIYARIM', 'YARIM'], 'fx:tam': ['TAM_YENI', 'YENITAM', 'TAM'], 'fx:ata': ['ATA_YENI', 'YENIATA', 'ATA'],
  'fx:ons': ['ONS', 'ONSALTIN'],
};
const norm = (s) => String(s).toUpperCase().replace(/İ/g, 'I').replace(/[^A-Z0-9_]/g, '');
function toNum(v) {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}
// Yanıtta { KOD: { alis, satis } } biçimli nesneyi bulur (kökte, data ya da benzeri altında olabilir).
function findTable(j, depth = 0) {
  if (!j || typeof j !== 'object' || depth > 3) return null;
  const keys = Object.keys(j);
  const hit = keys.filter((k) => j[k] && typeof j[k] === 'object' && !Array.isArray(j[k]) && ('satis' in j[k] || 'alis' in j[k] || 'sell' in j[k] || 'ask' in j[k]));
  if (hit.length >= 3) return j;
  for (const k of keys) { const t = findTable(j[k], depth + 1); if (t) return t; }
  return null;
}
function parse(j) {
  const t = findTable(j); if (!t) return null;
  const idx = {}; for (const k of Object.keys(t)) idx[norm(k)] = t[k];
  const out = {};
  for (const [id, codes] of Object.entries(MAP)) {
    for (const c of codes) {
      const r = idx[norm(c)]; if (!r) continue;
      const alis = toNum(r.alis ?? r.bid ?? r.buy), satis = toNum(r.satis ?? r.ask ?? r.sell);
      if (satis) { out[id] = { alis: alis || null, satis, code: c }; break; }
    }
  }
  return Object.keys(out).length >= 3 ? out : null;
}
let cache = { ts: 0, data: null };
async function fetchRaw() {
  let last = null;
  for (const u of URLS) {
    try {
      const post = u.includes('/dashboard/');
      const r = await fetch(u, { method: post ? 'POST' : 'GET', headers: post ? { ...HEAD, 'content-type': 'application/x-www-form-urlencoded' } : HEAD, body: post ? '' : undefined, signal: AbortSignal.timeout(7000) });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch (e) { /* JSON değil */ }
      last = { url: u, status: r.status, text, json };
      if (r.ok && json && parse(json)) return last;
    } catch (e) { last = { url: u, error: String(e.message || e) }; }
  }
  return last;
}
// Fiyatlar TL cinsinden; ons dolar cinsinden gelir (çağıran çevirir).
async function getHarem() {
  if (cache.ts && Date.now() - cache.ts < 45000) return cache.data;
  const raw = await fetchRaw();
  const data = raw && raw.json ? parse(raw.json) : null;
  cache = { ts: Date.now(), data };
  return data;
}
module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  const u = new URL(req.url || '/', 'http://x');
  if (u.searchParams.get('debug')) {
    const raw = await fetchRaw();
    res.end(JSON.stringify({ url: raw && raw.url, status: raw && raw.status, error: raw && raw.error, parsed: raw && raw.json ? parse(raw.json) : null, head: raw && raw.text ? raw.text.slice(0, 2500) : null }, null, 1));
    return;
  }
  const d = await getHarem();
  res.end(JSON.stringify({ updated: cache.ts, items: d }));
};
module.exports.getHarem = getHarem;
module.exports.parse = parse;
module.exports._reset = () => { cache = { ts: 0, data: null }; };
