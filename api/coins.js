// Coin verisi: CoinGecko'dan çeker, sadeleştirir, kısa süre önbellekte tutar.
// Ücretsiz anahtar (isteğe bağlı): COINGECKO_API_KEY ortam değişkeni.
const PAGES = Math.min(Number(process.env.COIN_PAGES || 2), 4); // 1 sayfa = 250 coin
const TTL = 120 * 1000;
const cache = {};

function slim(c) {
  const sp = (c.sparkline_in_7d && c.sparkline_in_7d.price) || [];
  const down = [];
  for (let i = 0; i < sp.length; i += 2) down.push(Number(sp[i].toPrecision(6)));
  if (sp.length && (sp.length - 1) % 2 !== 0) down.push(Number(sp[sp.length - 1].toPrecision(6)));
  return {
    id: c.id, symbol: c.symbol, name: c.name, image: c.image,
    price: c.current_price, mcap: c.market_cap, rank: c.market_cap_rank,
    vol: c.total_volume,
    c1h: c.price_change_percentage_1h_in_currency,
    c24: c.price_change_percentage_24h_in_currency,
    c7: c.price_change_percentage_7d_in_currency,
    c30: c.price_change_percentage_30d_in_currency,
    ath: c.ath_change_percentage,
    spark: down,
  };
}

async function load(vs) {
  const headers = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  const out = [];
  for (let page = 1; page <= PAGES; page++) {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=' + vs +
      '&order=market_cap_desc&per_page=250&page=' + page +
      '&sparkline=true&price_change_percentage=1h,24h,7d,30d';
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error('CoinGecko ' + r.status);
    const arr = await r.json();
    for (const c of arr) out.push(slim(c));
    if (arr.length < 250) break;
  }
  return out;
}

module.exports = async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const vs = (u.searchParams.get('vs') || 'usd').toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
  if (!['usd', 'try', 'eur'].includes(vs)) { res.statusCode = 400; res.end('bad vs'); return; }
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, s-maxage=120, stale-while-revalidate=300');
  const hit = cache[vs];
  try {
    if (!hit || Date.now() - hit.ts > TTL) {
      const coins = await load(vs);
      cache[vs] = { ts: Date.now(), coins };
    }
  } catch (e) {
    if (!cache[vs]) { res.statusCode = 502; res.end(JSON.stringify({ error: String(e.message || e) })); return; }
  }
  const c = cache[vs];
  res.end(JSON.stringify({ updated: c.ts, vs, coins: c.coins }));
};
