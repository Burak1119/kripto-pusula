// Altın fiyatları (TL): Trunçgil Finans'ın herkese açık, ücretsiz JSON akışından alış/satış fiyatları okunur.
// (Harem Altın'ın herkese açık bir veri adresi yok; sitesi fiyatları sayfa içinde yükler, bu yüzden oradan okunmuyor.)
// Tek yerden, kısa önbellekle okunur; alınamazsa ya da veri uç değerliyse null döner ve uygulama kendi hesabına geri düşer.
// Teşhis: /api/harem?debug=1 → ham yanıtın başı ve ayrıştırma sonucu.
const URLS = ['https://finans.truncgil.com/v4/today.json'];
const HEAD = { 'user-agent': 'Mozilla/5.0 (compatible; KriptoPusula/1.0; kisisel kullanim)', accept: 'application/json, text/plain, */*' };
// Uygulamadaki kalem → akıştaki olası kodlar (ilk bulunan alınır). Trunçgil kodları başta, eski Harem kodları yedekte.
const MAP = {
  'fx:gold': ['GRA', 'KULCEALTIN', 'GRAMALTIN', 'GRAM', 'ALTIN'], 'fx:22': ['YIA', '22AYARBILEZIK', 'AYAR22', '22AYAR'], 'fx:18': ['18AYARALTIN', 'AYAR18'], 'fx:14': ['14AYARALTIN', 'AYAR14', '14AYAR'],
  'fx:ceyrek': ['CEYREKALTIN', 'CEYREK_YENI', 'YENICEYREK', 'CEYREK'], 'fx:yarim': ['YARIMALTIN', 'YARIM_YENI', 'YENIYARIM', 'YARIM'], 'fx:tam': ['TAMALTIN', 'TAM_YENI', 'YENITAM', 'TAM'],
  'fx:ata': ['ATAALTIN', 'CUMHURIYETALTINI', 'ATA_YENI', 'YENIATA', 'ATA'],
  'fx:ons': ['ONS', 'ONSALTIN'],
};
const SELL_KEYS = ['satis', 'alis', 'sell', 'ask', 'selling', 'buying'];
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
  const hit = keys.filter((k) => j[k] && typeof j[k] === 'object' && !Array.isArray(j[k]) && Object.keys(j[k]).some((f) => SELL_KEYS.includes(f.toLowerCase())));
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
      const f = {}; for (const k of Object.keys(r)) f[k.toLowerCase()] = r[k];
      const alis = toNum(f.alis ?? f.bid ?? f.buy ?? f.buying), satis = toNum(f.satis ?? f.ask ?? f.sell ?? f.selling);
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
      const r = await fetch(u, { headers: HEAD, signal: AbortSignal.timeout(7000) });
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
