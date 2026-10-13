// CoinGecko ve RSS yanıtlarını taklit ederek sunucu kısmını test eder.
const assert = require('assert');
const spark = Array.from({ length: 168 }, (_, i) => 100 + i * 0.1);
global.fetch = async (url) => {
  if (url.includes('coingecko')) {
    const page = Number(/[&?]page=(\d+)/.exec(url)[1]);
    const arr = Array.from({ length: page === 1 ? 250 : 10 }, (_, i) => ({ id: 'c' + page + i, symbol: 's' + i, name: 'Coin' + i, image: 'x', current_price: 1.234567891, market_cap: 1e9, market_cap_rank: i + 1, total_volume: 1e7, price_change_percentage_1h_in_currency: 1, price_change_percentage_24h_in_currency: 2, price_change_percentage_7d_in_currency: 3, price_change_percentage_30d_in_currency: 4, ath_change_percentage: -10, sparkline_in_7d: { price: spark } }));
    return { ok: true, status: 200, json: async () => arr };
  }
  const xml = '<rss><channel><item><title><![CDATA[Bitcoin surges &amp; rallies]]></title><link>https://example.com/a</link><pubDate>Tue, 13 Oct 2026 10:00:00 GMT</pubDate></item><item><title>Kötü bağlantı</title><link>javascript:alert(1)</link></item></channel></rss>';
  return { ok: true, status: 200, text: async () => xml };
};
const mk = () => { const r = { h: {}, code: 200, setHeader(k, v) { this.h[k] = v; }, end(b) { this.body = b; } }; return r; };
(async () => {
  const coins = require('./../api/coins'); const r = mk();
  await coins({ url: '/api/coins?vs=try' }, r);
  const j = JSON.parse(r.body);
  assert.strictEqual(j.coins.length, 260); assert.strictEqual(j.vs, 'try');
  assert.strictEqual(j.coins[0].spark.length, 85); assert.strictEqual(j.coins[0].c7, 3);
  console.log('ok   coins: 260 coin, sparkline 168→85 nokta, son nokta korunuyor');
  const bad = mk(); await coins({ url: '/api/coins?vs=../etc' }, bad); assert.strictEqual(bad.statusCode, 400);
  console.log('ok   coins: geçersiz para birimi reddediliyor');
  const news = require('./../api/news'); const n = mk();
  await news({ url: '/api/news' }, n);
  const nj = JSON.parse(n.body);
  assert(nj.news.length >= 1 && nj.news[0].title === 'Bitcoin surges & rallies');
  assert(nj.news.every((x) => /^https?:\/\//.test(x.link)));
  console.log('ok   news: CDATA çözüldü, güvensiz bağlantı elendi (' + nj.news.length + ' haber)');
})().catch((e) => { console.error('HATA', e); process.exit(1); });
