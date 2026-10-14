// Zamanlayıcının (cron-job.org) 10 dakikada bir çağırdığı kontrol: her abone için sinyal değişimi, sert hareket ve fiyat alarmı
// bakar, varsa bildirim gönderir. Adres anahtarla korunur: /api/cron?key=CRON_KEY
const E = require('./_engine');
const store = require('./_store');
const push = require('./_push');
const coinsApi = require('./coins'), stocksApi = require('./stocks'), newsApi = require('./news'), fxApi = require('./fx');
let lastRun = 0;
// Diğer uç noktaları HTTP'siz, doğrudan (önbellekleriyle) çağırır.
async function callApi(fn, path) {
  return new Promise((resolve, reject) => {
    let code = 200;
    const res = { statusCode: 200, setHeader() {}, end(s) { try { resolve({ code: res.statusCode, json: JSON.parse(s) }); } catch (e) { reject(e); } } };
    Promise.resolve(fn({ url: path, method: 'GET', headers: {} }, res)).catch(reject);
  });
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function coinItems(ids, vs, news) {
  const out = {};
  for (const part of chunk([...ids.values()], 40)) {
    const q = part.map((x) => 'c=' + encodeURIComponent([x.id, x.sym, x.name].join('|'))).join('&');
    const r = await callApi(coinsApi, '/api/coins?vs=' + vs + '&' + q);
    const coins = (r.json && r.json.coins) || [], ctx = E.newsContext(news, coins);
    for (const c of coins) { c.a = E.analyze(c, ctx); out[c.req || c.id] = c; }
  }
  return out;
}
module.exports = async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  const out = (o, code) => { res.statusCode = code || 200; res.end(JSON.stringify(o)); };
  const key = process.env.CRON_KEY || '';
  if (!key || u.searchParams.get('key') !== key) return out({ error: 'Anahtar yanlış ya da tanımlı değil' }, 401);
  if (!store.configured() || !push.configured()) return out({ ok: false, reason: 'depo ya da VAPID anahtarları tanımlı değil' }, 503);
  if (Date.now() - lastRun < 90000) return out({ ok: true, skipped: 'az önce çalıştı' });
  lastRun = Date.now();
  const host = req.headers && req.headers.host, day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10), now = Date.now();
  try {
    const ids = await store.smembers('subs');
    const recs = (await store.mgetJson(ids.map((i) => 'sub:' + i))).map((r, i) => (r ? { id: ids[i], r } : null)).filter(Boolean);
    if (!recs.length) return out({ ok: true, subs: 0 });
    // Hangi varlıklar lazım?
    const coinAll = new Map(), stockAny = { v: false }, coinCcy = {}; let fxNeed = false;
    const ihour = new Date(Date.now() + 3 * 3600e3).getUTCHours();
    const due = (r) => Number.isInteger(r.morning) && ihour >= r.morning && ihour < r.morning + 3 && !(r.done && r.done.morning === day);
    for (const { r } of recs) {
      if (due(r)) fxNeed = true;
      for (const w of r.watch) { if (w.k === 'c') coinAll.set(w.id, w); else stockAny.v = true; }
      for (const a of r.alerts) { if (a.done) continue; if (a.k === 'f') fxNeed = true; else if (a.k === 'c') { coinAll.set(a.id, coinAll.get(a.id) || a); (coinCcy[a.ccy] = coinCcy[a.ccy] || new Map()).set(a.id, a); } else stockAny.v = true; }
    }
    const [cn, sn] = await Promise.all([coinAll.size ? callApi(newsApi, '/api/news').catch(() => null) : null, stockAny.v ? callApi(newsApi, '/api/news?kind=stock').catch(() => null) : null]);
    let coinsTry = {}, stocks = {}; const priceBy = {};
    if (coinAll.size) coinsTry = await coinItems(coinAll, 'try', (cn && cn.json.news) || []);
    for (const [ccy, m] of Object.entries(coinCcy)) { if (ccy === 'TRY') priceBy.TRY = coinsTry; else priceBy[ccy] = await coinItems(m, ccy.toLowerCase(), []); }
    if (stockAny.v) {
      const raw = (await callApi(stocksApi, '/api/stocks')).json;
      for (const it of E.buildStockWorld(raw, (sn && sn.json.news) || []).items) stocks[it.id] = it;
    }
    let fxt = [];
    if (fxNeed) { try { const j = (await callApi(fxApi, '/api/fx')).json; fxt = E.fxTable(j.USD, j.EUR, j.gold && j.gold.usdOz, j.gold && j.gold.chg, j.harem); } catch (e) { fxt = []; } }
    const fxPrice = {}; for (const x of fxt) fxPrice[x.id] = x.price;
    let sent = 0, gone = 0;
    for (const { id, r } of recs) {
      const w = E.watchMessages(r.watch, (x) => (x.k === 'c' ? coinsTry[x.id] : stocks[x.id]), r.sigs, r.done, day);
      const am = E.alertsRun(r.alerts, (a) => { if (a.k === 'f') return fxPrice[a.id] ?? null; const it = a.k === 'c' ? (priceBy[a.ccy] || {})[a.id] : stocks[a.id]; return it ? it.price : null; }, now);
      const isDue = due(r); r.sigs = { ...r.sigs, ...w.sigs }; r.done = w.done;
      const mm = isDue ? E.morningMessage(r.watch, (x) => (x.k === 'c' ? coinsTry[x.id] : stocks[x.id]), fxt) : null;
      if (isDue && mm) r.done.morning = day;
      const msgs = [...(mm ? [mm] : []), ...am, ...w.msgs].slice(0, 6);
      if (msgs.length) {
        for (const m of msgs) await store.rpush('msg:' + id, m);
        await store.ltrim('msg:' + id, -20, -1); await store.expire('msg:' + id, 259200);
        const p = await push.send(r.endpoint, host);
        if (p.gone) { await store.del('sub:' + id); await store.srem('subs', id); await store.del('msg:' + id); gone++; continue; }
        if (p.ok) sent++;
      }
      await store.setJson('sub:' + id, r);
    }
    return out({ ok: true, subs: recs.length, sent, gone });
  } catch (e) { lastRun = 0; return out({ ok: false, error: String(e.message || e) }, 502); }
};
