const assert = require('assert');
const ex = require('../api/exchanges');
// Midas tablosuna benzeyen örnek HTML (satır başına logo bağlantısı + ad bağlantısı + fiyat + değişim)
const html = `
<table><tbody>
<tr><td><a href="/canli-kripto/bitcoin"><img src="x.png"></a><a href="https://www.getmidas.com/canli-kripto/bitcoin"><span>BTC</span> <span>Bitcoin</span></a></td><td>$81.779,00</td><td><span>-2,51%</span></td><td>$1,6 Tr</td></tr>
<tr><td><a href="/canli-kripto/shib-coin"><b>SHIB</b> Shiba Inu</a></td><td>$0,0000052106</td><td>+1,20%</td></tr>
<tr><td><a href="/canli-kripto/dogecoin">DOGE Dogecoin</a></td><td>$0,08</td><td>−4,00%</td></tr>
</tbody></table><a href="/canli-kripto/memecoinler">Memecoin Listesi</a>`;
const m = ex.parseMidas(html);
assert.deepStrictEqual(m.BTC, { slug: 'bitcoin', p: 81779, c: -2.51 });
assert.strictEqual(m.SHIB.slug, 'shib-coin'); assert.strictEqual(m.SHIB.c, 1.2);
assert.strictEqual(m.DOGE.c, -4);
assert(!m.Memecoin && Object.keys(m).length === 3);
console.log('ok   midas: 3 coin okundu, fiyat/değişim/bağlantı doğru, kategori bağlantısı atlandı');
const b = ex.parseBinance([
  { symbol: 'BTCUSDT', lastPrice: '81000.5', priceChangePercent: '-2.1', quoteVolume: '9000000' },
  { symbol: 'BTCTRY', lastPrice: '3300000' },
  { symbol: 'BTCUPUSDT', lastPrice: '5', priceChangePercent: '1', quoteVolume: '1' },
  { symbol: 'ABCTRY', lastPrice: '1' },
  { symbol: 'ETHBTC', lastPrice: '0.04' },
]);
assert.strictEqual(b.BTC.p, 81000.5); assert.strictEqual(b.BTC.t, 3300000); assert.strictEqual(b.BTC.c, -2.1);
assert(!b.BTCUP && !b.ABC && !b.ETH);
console.log('ok   binance: USDT/TRY paritesi birleşti, kaldıraçlı token ve tek TRY paritesi elendi');
