// Dönem grafiği ucunu sahte Binance/Yahoo yanıtlarıyla test eder.
const assert = require('assert');
const calls = [];
global.fetch = async (url) => {
  calls.push(url);
  if (url.includes('klines')) {
    if (url.includes('symbol=FAILUSDT')) return { ok: false, status: 400, json: async () => ({}) };
    const lim = Number(/limit=(\d+)/.exec(url)[1]);
    return { ok: true, status: 200, json: async () => Array.from({ length: lim }, (_, i) => [1e12 + i * 6e4, '1', '1', '1', String(100 + i), '0']) };
  }
  if (url.includes('finance/chart')) {
    const n = 100, ts = Array.from({ length: n }, (_, i) => 1.7e9 + i * 60), close = Array.from({ length: n }, (_, i) => (i === 5 ? null : 10 + i));
    return { ok: true, status: 200, json: async () => ({ chart: { result: [{ timestamp: ts, indicators: { quote: [{ close }] } }] } }) };
  }
  throw new Error('beklenmeyen istek: ' + url);
};
const mk = () => ({ h: {}, statusCode: 200, setHeader(k, v) { this.h[k] = v; }, end(b) { this.body = b; } });
const run = async (url) => { const r = mk(); await h({ url }, r); return r; };
const h = require('./../api/chart');
(async () => {
  let r = await run('/api/chart?k=c&sym=btc&p=1g'); let j = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200); assert.strictEqual(j.v.length, 288); assert.strictEqual(j.v[287], 387);
  assert(calls[0].includes('symbol=BTCUSDT') && calls[0].includes('interval=5m'));
  console.log('ok   coin: 1 günlük grafik Binance 5 dakikalık mumlardan geldi');
  const n = calls.length; await run('/api/chart?k=c&sym=BTC&p=1g'); assert.strictEqual(calls.length, n);
  console.log('ok   coin: aynı istek kısa süre önbellekten döndü');
  r = await run('/api/chart?k=c&sym=FAIL&p=1h'); assert.strictEqual(r.statusCode, 502);
  console.log('ok   coin: Binance\'te olmayan coin hata döndürdü');
  r = await run('/api/chart?k=s&sym=thyao&mk=bist&p=1s'); j = JSON.parse(r.body);
  assert(calls.at(-1).includes('THYAO.IS') && calls.at(-1).includes('interval=1m'));
  assert.strictEqual(j.v.length, 60); assert.strictEqual(j.v[59], 109);
  console.log('ok   hisse: 1 saatlik grafik son 60 dakikayı verdi (boş değerler atlandı)');
  r = await run('/api/chart?k=s&sym=AAPL&mk=us&p=1y'); j = JSON.parse(r.body);
  assert(calls.at(-1).includes('symbol') === false && calls.at(-1).includes('/AAPL?') && j.v.length === 99);
  console.log('ok   hisse: ABD hissesine ek takı eklenmedi');
  r = await run('/api/chart?k=c&sym=BTC&p=zzz'); assert.strictEqual(r.statusCode, 400);
  r = await run('/api/chart?k=c&p=1h'); assert.strictEqual(r.statusCode, 400);
  console.log('ok   geçersiz dönem ve eksik sembol reddedildi');
})().catch((e) => { console.error(e); process.exit(1); });
