// Döviz kuru: 1 doların ve 1 euronun kaç lira ettiği. Önce CoinGecko'daki Tether fiyatından (dolara bağlı),
// olmazsa açık bir kur servisinden okunur. Kur bulunamazsa uygulama tek toplam göstermez, geri kalanı etkilenmez.
const TTL = 10 * 60 * 1000;
let cache = { ts: 0, data: null };

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
const good = (v) => typeof v === 'number' && isFinite(v) && v > 0;
async function fromGecko() {
  const j = await getJson('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd,try,eur');
  const t = j && j.tether;
  if (!t || !good(t.usd) || !good(t.try) || !good(t.eur)) throw new Error('Tether fiyatı eksik');
  return { USD: t.try / t.usd, EUR: t.try / t.eur, src: 'coingecko' };
}
async function fromOpen() {
  const j = await getJson('https://open.er-api.com/v6/latest/USD');
  const r = j && j.rates;
  if (!r || !good(r.TRY) || !good(r.EUR)) throw new Error('Kur eksik');
  return { USD: r.TRY, EUR: r.TRY / r.EUR, src: 'er-api' };
}

// Ons altın fiyatı (dolar): Binance'teki PAXG (altına bağlı token) fiyatından; 24 saatlik değişimiyle. Alınamazsa null, kur etkilenmez.
async function gold() {
  try {
    const j = await getJson('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=PAXGUSDT');
    const p = Number(j.lastPrice), c = Number(j.priceChangePercent);
    return good(p) ? { usdOz: p, chg: isFinite(c) ? c : null } : null;
  } catch (e) { return null; }
}

async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, s-maxage=600, stale-while-revalidate=1800');
  if (!cache.data || Date.now() - cache.ts > TTL) {
    let d = null;
    for (const f of [fromGecko, fromOpen]) { try { d = await f(); break; } catch (e) { /* sıradaki kaynak */ } }
    if (d) cache = { ts: Date.now(), data: { ...d, gold: await gold() } };
    else if (!cache.data) { res.statusCode = 502; res.end(JSON.stringify({ error: 'kur alınamadı' })); return; }
  }
  const d = cache.data;
  res.end(JSON.stringify({ updated: cache.ts, TRY: 1, USD: d.USD, EUR: d.EUR, src: d.src, gold: d.gold || null }));
}
module.exports = handler;
module.exports._reset = () => { cache = { ts: 0, data: null }; };
