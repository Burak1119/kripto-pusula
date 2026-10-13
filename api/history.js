// Geçmiş fiyatlar (sinyal karnesi için): Binance'in herkese açık mum verisinden, seçili büyük coinlerin
// son ~83 günlük kapanışları, 2 saatte bir örneklenmiş olarak. Anahtar gerekmez.
const SYMS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'TRX', 'AVAX', 'LINK', 'DOT', 'LTC', 'BCH', 'NEAR', 'UNI', 'ATOM', 'XLM', 'ETC', 'FIL', 'APT',
  'ARB', 'OP', 'INJ', 'AAVE', 'SUI', 'HBAR', 'TON', 'ALGO', 'GRT', 'SHIB'];
const TTL = 6 * 3600 * 1000;
let cache = { ts: 0, coins: {} };

async function klines(sym, endTime) {
  const url = 'https://data-api.binance.vision/api/v3/klines?symbol=' + sym + 'USDT&interval=1h&limit=1000' + (endTime ? '&endTime=' + endTime : '');
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('Binance ' + r.status);
  const a = await r.json();
  if (!Array.isArray(a)) throw new Error('bozuk yanıt');
  return a;
}
// Eskiden yeniye sıralı kapanışlar; her ikinci saat alınır (uygulamadaki 7 günlük çizgiyle aynı sıklık).
async function load(sym) {
  const recent = await klines(sym);
  const older = recent.length ? await klines(sym, recent[0][0] - 1).catch(() => []) : [];
  const closes = [...older, ...recent].map((k) => Number(k[4])).filter((v) => v > 0);
  const out = [];
  for (let i = closes.length - 1; i >= 0; i -= 2) out.unshift(Number(closes[i].toPrecision(6)));
  return out;
}

async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, s-maxage=21600, stale-while-revalidate=43200');
  if (!cache.ts || Date.now() - cache.ts > TTL) {
    const coins = {};
    for (let i = 0; i < SYMS.length; i += 10) {
      await Promise.allSettled(SYMS.slice(i, i + 10).map(async (s) => { const c = await load(s); if (c.length > 500) coins[s] = c; }));
    }
    if (Object.keys(coins).length) cache = { ts: Date.now(), coins };
    else if (!cache.ts) { res.statusCode = 502; res.end(JSON.stringify({ error: 'geçmiş veri alınamadı' })); return; }
  }
  res.end(JSON.stringify({ updated: cache.ts, step: 2, coins: cache.coins }));
}
module.exports = handler;
module.exports._reset = () => { cache = { ts: 0, coins: {} }; };
module.exports.SYMS = SYMS;
