// Portföy için tek tek coin isteme: kimlik doğruysa doğrudan, yanlışsa ad+sembolle aratıp bulma.
const assert = require('assert');
const spark = Array.from({ length: 168 }, (_, i) => 100 + i * 0.1);
const calls = [];
const row = (id, sym, name, rank) => ({ id, symbol: sym, name, image: 'x', current_price: 2.5, market_cap: 1e6, market_cap_rank: rank, total_volume: 1e5, price_change_percentage_24h_in_currency: 1, sparkline_in_7d: { price: spark } });
const DB = { bitcoin: row('bitcoin', 'btc', 'Bitcoin', 1), 'katana-network': row('katana-network', 'kat', 'Katana', 300), 'sleepless-ai': row('sleepless-ai', 'ai', 'Sleepless AI', 900) };
global.fetch = async (url) => {
  calls.push(url);
  if (url.includes('/search')) return { ok: true, status: 200, json: async () => ({ coins: [{ id: 'katana-inu', symbol: 'KATA', market_cap_rank: 1200 }, { id: 'katana-network', symbol: 'KAT', market_cap_rank: 300 }, { id: 'kat-other', symbol: 'KAT', market_cap_rank: null }] }) };
  const ids = (/[&?]ids=([^&]+)/.exec(url) || [])[1];
  assert(ids, 'ids parametresi yok: ' + url);
  return { ok: true, status: 200, json: async () => ids.split(',').filter((i) => DB[i]).map((i) => DB[i]) };
};
const mk = () => ({ h: {}, setHeader(k, v) { this.h[k] = v; }, end(b) { this.body = b; } });
(async () => {
  const coins = require('./../api/coins'); const r = mk();
  await coins({ url: '/api/coins?vs=try&c=bitcoin|btc|Bitcoin&c=katana|kat|Katana&c=sleepless-ai|ai|Sleepless%20AI&c=../etc|x|y&c=bitcoin|btc|Bitcoin' }, r);
  const j = JSON.parse(r.body);
  assert.strictEqual(j.vs, 'try');
  assert.deepStrictEqual(j.coins.map((c) => c.req).sort(), ['bitcoin', 'katana', 'sleepless-ai']);
  assert.strictEqual(j.coins.find((c) => c.req === 'katana').id, 'katana-network');
  assert.strictEqual(j.coins.find((c) => c.req === 'katana').spark.length, 85);
  console.log('ok   coins?c=: bilinen kimlik doğrudan, yanlış kimlik (katana) ad+sembolle bulundu, bozuk ve yinelenen istek elendi');
  const before = calls.length; const r2 = mk();
  await coins({ url: '/api/coins?vs=try&c=sleepless-ai|ai|Sleepless%20AI&c=katana|kat|Katana&c=bitcoin|btc|Bitcoin' }, r2);
  assert.strictEqual(calls.length, before); // önbellekten geldi
  console.log('ok   coins?c=: aynı istek önbellekten geldi, ek sorgu yok');
  const none = mk(); await coins({ url: '/api/coins?vs=try&c=Bad%20Id' }, none);
  assert(none.body && none.body.length, 'yanıt var');
})().catch((e) => { console.error('HATA', e); process.exit(1); });
