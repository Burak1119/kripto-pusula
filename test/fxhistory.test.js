// Kur ve geçmiş veri uçlarını sahte yanıtlarla test eder.
const assert = require('assert');
let mode = 'gecko';
global.fetch = async (url) => {
  if (url.includes('simple/price')) {
    if (mode === 'gecko') return { ok: true, status: 200, json: async () => ({ tether: { usd: 1.0004, try: 41.2, eur: 0.8645 } }) };
    return { ok: false, status: 429, json: async () => ({}) };
  }
  if (url.includes('ticker/24hr')) return { ok: true, status: 200, json: async () => ({ lastPrice: '2700.50', priceChangePercent: '0.8' }) };
  if (url.includes('open.er-api')) return { ok: true, status: 200, json: async () => ({ rates: { TRY: 41.0, EUR: 0.86 } }) };
  if (url.includes('klines')) {
    if (url.includes('symbol=FAILUSDT')) return { ok: false, status: 400, json: async () => ({}) };
    const m = /endTime=(\d+)/.exec(url);
    const base = m ? Number(m[1]) + 1 - 1000 * 3600e3 : Date.now() - 1000 * 3600e3;
    const arr = Array.from({ length: 1000 }, (_, i) => [base + i * 3600e3, '1', '1', '1', String(100 + (m ? 0 : 1000) + i * 0.01), '0']);
    return { ok: true, status: 200, json: async () => arr };
  }
  throw new Error('beklenmeyen istek: ' + url);
};
const mk = () => ({ h: {}, setHeader(k, v) { this.h[k] = v; }, end(b) { this.body = b; } });
(async () => {
  const fx = require('./../api/fx'); let r = mk();
  await fx({ url: '/api/fx' }, r);
  let j = JSON.parse(r.body);
  assert(Math.abs(j.USD - 41.2 / 1.0004) < 1e-9 && Math.abs(j.EUR - 41.2 / 0.8645) < 1e-9 && j.TRY === 1 && j.src === 'coingecko');
  assert(j.gold && j.gold.usdOz === 2700.5 && j.gold.chg === 0.8);
  console.log('ok   fx: dolar ve euro kuru Tether fiyatından hesaplandı (' + j.USD.toFixed(2) + ' / ' + j.EUR.toFixed(2) + ')');
  fx._reset(); mode = 'down'; r = mk();
  await fx({ url: '/api/fx' }, r);
  j = JSON.parse(r.body);
  assert(j.src === 'er-api' && Math.abs(j.EUR - 41 / 0.86) < 1e-9);
  console.log('ok   fx: CoinGecko çalışmayınca ikinci kaynağa geçti');
  const hist = require('./../api/history'); r = mk();
  await hist({ url: '/api/history' }, r);
  j = JSON.parse(r.body);
  const keys = Object.keys(j.coins);
  assert(keys.length === hist.SYMS.length && j.step === 2);
  assert(j.coins.BTC.length >= 999 && j.coins.BTC.length <= 1001, 'her ikinci saat: ' + j.coins.BTC.length);
  assert(j.coins.BTC[0] < j.coins.BTC[j.coins.BTC.length - 1] || j.coins.BTC.length > 900, 'eskiden yeniye');
  console.log('ok   history: ' + keys.length + ' coin, her biri ~' + j.coins.BTC.length + ' nokta (83 gün, 2 saatte bir)');
})().catch((e) => { console.error('HATA', e); process.exit(1); });
