// Borsa verileri: Binance (herkese açık piyasa verisi) ve Midas (herkese açık canlı kripto sayfası).
// Midas'ın resmi bir API'si yok; sayfadaki tablo okunur. Sayfa tasarımı değişirse Midas kısmı boş döner,
// uygulamanın geri kalanı çalışmaya devam eder.
const TTL = 60 * 1000;
let cache = { ts: 0, binance: {}, midas: {}, ok: { binance: false, midas: false } };

const strip = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const trNum = (s) => { const n = Number(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

function parseMidas(html) {
  const out = {};
  const re = /<a\b[^>]*href="(?:https?:\/\/(?:www\.)?getmidas\.com)?\/canli-kripto\/([a-z0-9][a-z0-9-]*)\/?"[^>]*>([\s\S]*?)<\/a>/gi;
  const hits = [];
  let m;
  while ((m = re.exec(html))) hits.push({ slug: m[1], text: strip(m[2]), start: m.index, end: re.lastIndex });
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (!h.text) continue;
    const sym = h.text.split(' ').find((t) => /^[A-Z0-9]{2,12}$/.test(t));
    if (!sym || out[sym]) continue;
    let next = hits.findIndex((x, j) => j > i && x.slug !== h.slug);
    const stop = next === -1 ? h.end + 1500 : hits[next].start;
    const seg = strip(html.slice(h.end, Math.min(stop, h.end + 1500)));
    const pm = seg.match(/\$\s?([\d.]+(?:,\d+)?)/);
    const cm = seg.replace(/−/g, '-').match(/([-+]?\s?\d+(?:,\d+)?)\s?%/);
    const p = pm ? trNum(pm[1]) : null;
    if (p === null) continue;
    out[sym] = { slug: h.slug, p, c: cm ? trNum(cm[1].replace(/\s/g, '').replace('+', '')) : null };
  }
  return out;
}

function parseBinance(arr) {
  const out = {};
  const lev = /(UP|DOWN|BULL|BEAR)$/;
  for (const quote of ['USDT', 'TRY']) {
    for (const t of arr) {
      if (!t.symbol || !t.symbol.endsWith(quote)) continue;
      const base = t.symbol.slice(0, -quote.length);
      if (!base || (base.length > 3 && lev.test(base))) continue;
      const last = Number(t.lastPrice);
      if (!(last > 0)) continue;
      const o = out[base] || (out[base] = {});
      if (quote === 'USDT') { o.p = last; o.c = Number(t.priceChangePercent); o.v = Number(t.quoteVolume); }
      else o.t = last;
    }
  }
  for (const k of Object.keys(out)) if (out[k].p === undefined) delete out[k]; // yalnızca TRY paritesi olanları atla
  return out;
}

async function getBinance() {
  const r = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr', { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('Binance ' + r.status);
  return parseBinance(await r.json());
}
async function getMidas() {
  const r = await fetch('https://www.getmidas.com/canli-kripto/', { headers: { 'user-agent': 'KriptoPusula/1.0 (kisisel kullanim)', accept: 'text/html' } });
  if (!r.ok) throw new Error('Midas ' + r.status);
  const out = parseMidas(await r.text());
  if (!Object.keys(out).length) throw new Error('Midas tablosu okunamadı');
  return out;
}

async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=120');
  if (Date.now() - cache.ts > TTL) {
    const [b, m] = await Promise.allSettled([getBinance(), getMidas()]);
    cache = {
      ts: Date.now(),
      binance: b.status === 'fulfilled' ? b.value : cache.binance,
      midas: m.status === 'fulfilled' ? m.value : cache.midas,
      ok: { binance: b.status === 'fulfilled', midas: m.status === 'fulfilled' },
    };
  }
  res.end(JSON.stringify({ updated: cache.ts, binance: cache.binance, midas: cache.midas, ok: cache.ok }));
}
module.exports = handler;
module.exports.parseMidas = parseMidas;
module.exports.parseBinance = parseBinance;
