// Tek bir coin veya hisse için seçilen dönemin fiyat çizgisi.
// Coin: Binance herkese açık mum verisi (SYMBOLUSDT). Hisse: Yahoo Finance grafik verisi. Anahtar gerekmez.
// GET /api/chart?k=c&sym=BTC&p=1g   |   GET /api/chart?k=s&sym=THYAO&mk=bist&p=1a
// p: 1s (1 saat), 1g (1 gün), 1h (1 hafta), 1a (1 ay), 3a (3 ay), 1y (1 yıl)
const BINANCE = { '1s': ['1m', 60], '1g': ['5m', 288], '1h': ['1h', 168], '1a': ['4h', 180], '3a': ['1d', 90], '1y': ['1d', 365] };
const YAHOO = { '1s': ['1d', '1m', 60], '1g': ['1d', '5m', 0], '1h': ['5d', '30m', 0], '1a': ['1mo', '60m', 0], '3a': ['3mo', '1d', 0], '1y': ['1y', '1d', 0] };
const TTL = { '1s': 15, '1g': 20, '1h': 60, '1a': 120, '3a': 300, '1y': 300 };
const cache = new Map();

const out = (res, code, obj, p) => {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', code === 200 ? `public, s-maxage=${TTL[p] || 30}, stale-while-revalidate=${(TTL[p] || 30) * 2}` : 'no-store');
  res.end(JSON.stringify(obj));
};
const clean = (arr) => arr.filter((r) => Number.isFinite(r[1]) && r[1] > 0);

async function coin(sym, p) {
  const [iv, lim] = BINANCE[p];
  const r = await fetch('https://data-api.binance.vision/api/v3/klines?symbol=' + sym + 'USDT&interval=' + iv + '&limit=' + lim, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error('Binance ' + r.status);
  const a = await r.json();
  if (!Array.isArray(a)) throw new Error('bozuk yanıt');
  return clean(a.map((k) => [Number(k[0]), Number(k[4])]));
}
async function stock(sym, mk, p) {
  const suffix = mk === 'bist' ? '.IS' : mk === 'eu' ? '.DE' : '';
  const [range, iv, keep] = YAHOO[p];
  const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym + suffix) + '?range=' + range + '&interval=' + iv, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error('Yahoo ' + r.status);
  const j = await r.json(), res = j && j.chart && j.chart.result && j.chart.result[0];
  const q = res && res.indicators && res.indicators.quote && res.indicators.quote[0], ts = (res && res.timestamp) || [];
  if (!q || !q.close) throw new Error('bozuk yanıt');
  let rows = clean(q.close.map((c, i) => [Number(ts[i]) * 1000, Number(c)]));
  if (keep && rows.length > keep) rows = rows.slice(-keep);
  return rows;
}

async function handler(req, res) {
  const u = new URL(req.url || '/', 'http://x'), q = u.searchParams;
  const k = q.get('k') === 's' ? 's' : 'c', p = q.get('p') || '1h', mk = ['us', 'bist', 'eu'].includes(q.get('mk')) ? q.get('mk') : 'us';
  const sym = String(q.get('sym') || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 15);
  if (!sym || !BINANCE[p]) return out(res, 400, { error: 'Geçersiz istek' }, p);
  const key = [k, sym, mk, p].join('|'), hit = cache.get(key);
  if (hit && Date.now() - hit.ts < (TTL[p] || 30) * 1000) return out(res, 200, hit.v, p);
  try {
    const rows = k === 'c' ? await coin(sym.replace(/[^A-Z0-9]/g, ''), p) : await stock(sym, mk, p);
    if (rows.length < 2) throw new Error('veri yok');
    const v = { p, updated: Date.now(), t: rows.map((r) => r[0]), v: rows.map((r) => Number(r[1].toPrecision(7))) };
    if (cache.size > 300) cache.clear();
    cache.set(key, { ts: Date.now(), v });
    out(res, 200, v, p);
  } catch (e) {
    if (hit) return out(res, 200, hit.v, p);
    out(res, 502, { error: String(e.message || e) }, p);
  }
}
module.exports = handler;
module.exports._reset = () => cache.clear();
