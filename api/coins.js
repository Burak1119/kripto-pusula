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

// Portföydeki coinler için: ilk 500'de olmasa da tek tek istenen coinleri getirir.
// İstek biçimi: c=<coingecko-id>|<sembol>|<ad> (birden çok kez). Kimlik tutmazsa ad ile aratıp sembolü eşleşeni bulur.
const resolved = {};
const xcache = {};
function cgHeaders() {
  const headers = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  return headers;
}
async function cg(path) {
  const r = await fetch('https://api.coingecko.com/api/v3' + path, { headers: cgHeaders(), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('CoinGecko ' + r.status);
  return r.json();
}
const mk = (vs, ids) => '/coins/markets?vs_currency=' + vs + '&ids=' + ids.join(',') + '&order=market_cap_desc&per_page=250&sparkline=true&price_change_percentage=1h,24h,7d,30d';
function parseReqs(u) {
  const out = [], seen = new Set();
  for (const raw of u.searchParams.getAll('c').slice(0, 40)) {
    const [id, sym = '', name = ''] = raw.split('|');
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, sym: sym.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15), name: name.replace(/[^\p{L}\p{N} .&-]/gu, '').slice(0, 60) });
  }
  return out;
}
async function loadExtra(vs, reqs) {
  const real = (r) => resolved[r.id] || r.id;
  const got = new Map();
  try { for (const c of await cg(mk(vs, reqs.map(real)))) got.set(c.id, c); } catch (e) { if (!reqs.some((r) => resolved[r.id])) throw e; }
  for (const r of reqs.filter((x) => !got.has(real(x)) && x.name && x.sym)) {
    try {
      const s = await cg('/search?query=' + encodeURIComponent(r.name));
      const cand = (s.coins || []).filter((c) => String(c.symbol).toLowerCase() === r.sym)
        .sort((a, b) => (a.market_cap_rank || 1e9) - (b.market_cap_rank || 1e9))[0];
      if (!cand) continue;
      resolved[r.id] = cand.id;
      for (const c of await cg(mk(vs, [cand.id]))) got.set(c.id, c);
    } catch (e) { /* bu coin atlanır, diğerleri etkilenmez */ }
  }
  return reqs.map((r) => { const c = got.get(real(r)); return c ? Object.assign(slim(c), { req: r.id }) : null; }).filter(Boolean);
}

module.exports = async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const vs = (u.searchParams.get('vs') || 'usd').toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
  if (!['usd', 'try', 'eur'].includes(vs)) { res.statusCode = 400; res.end('bad vs'); return; }
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, s-maxage=120, stale-while-revalidate=300');
  const reqs = parseReqs(u);
  if (reqs.length) {
    const key = vs + ':' + reqs.map((r) => r.id).sort().join(',');
    const h = xcache[key];
    try {
      if (!h || Date.now() - h.ts > TTL) xcache[key] = { ts: Date.now(), coins: await loadExtra(vs, reqs) };
    } catch (e) {
      if (!xcache[key]) { res.statusCode = 502; res.end(JSON.stringify({ error: String(e.message || e) })); return; }
    }
    res.end(JSON.stringify({ updated: xcache[key].ts, vs, coins: xcache[key].coins }));
    return;
  }
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
