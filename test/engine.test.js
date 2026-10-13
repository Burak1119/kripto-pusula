// Analiz motorunu uygulama dosyasından çıkarıp Node'da test eder.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
const code = html.split('// ENGINE START')[1].split('// ENGINE END')[0];
const E = new Function(code + '; return { analyze, analyzeAll, makeDemo, headlineScore, sparkStats, rsi14, newsContext };')();

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('HATA:', m); } else console.log('ok  ', m); };

// Haber tonu
ok(E.headlineScore('Bitcoin surges to record high after ETF approval') > 0, 'olumlu başlık pozitif');
ok(E.headlineScore('Exchange hacked, millions lost in exploit') < 0, 'olumsuz başlık negatif');
ok(E.headlineScore('Bank announces new custody service') === 0, '"bank" ban sayılmıyor');
ok(E.headlineScore('Bitcoin rekor kırdı, yükseliş sürüyor') > 0, 'Türkçe olumlu');
ok(E.headlineScore('Borsaya dava açıldı, çöküş endişesi') < 0, 'Türkçe olumsuz');

// RSI
const up = Array.from({ length: 40 }, (_, i) => 100 + i);
const dn = up.slice().reverse();
ok(E.rsi14(up) > 90, 'sürekli yükselişte RSI yüksek');
ok(E.rsi14(dn) < 10, 'sürekli düşüşte RSI düşük');

// Demo verisi üzerinde bütünlük
const d = E.makeDemo();
const info = E.analyzeAll(d.coins, d.news);
ok(d.coins.length >= 40, 'demo coin sayısı ' + d.coins.length);
const sigs = new Set(d.coins.map((c) => c.a.signal));
console.log('Sinyal dağılımı:', [...sigs].join(', '), JSON.stringify(info.tally), 'ruh hali:', info.mood, info.moodScore.toFixed(1));
ok(d.coins.every((c) => Number.isFinite(c.a.score) && c.a.score >= -100 && c.a.score <= 100), 'tüm puanlar -100..100 aralığında');
ok(d.coins.filter((c) => ['usdt', 'usdc', 'dai'].includes(c.symbol)).every((c) => c.a.signal === 'STABİL'), 'stabil coinlere sinyal verilmiyor');
ok(sigs.size >= 3, 'en az 3 farklı sinyal üretiliyor');
ok(d.coins.every((c) => c.a.reasons.length > 0), 'her coin için gerekçe var');

// Uç durumlar: eksik veri çökmemeli
const bare = { id: 'x', symbol: 'xyz', name: 'Xyz', price: 1, rank: 400, spark: [] };
const ctx = E.newsContext([], [bare]);
const a = E.analyze(bare, ctx);
ok(a.signal && Number.isFinite(a.score), 'sparkline ve değişim verisi olmayan coin çökmüyor');

// Aşırı ısınma
const hot = { id: 'h', symbol: 'hot', name: 'Hotcoin', price: 2, rank: 50, mcap: 1e9, vol: 2e8, c24: 40, c7: 80, c30: 150, spark: Array.from({ length: 84 }, (_, i) => 1 + i * 0.012) };
const ah = E.analyze(hot, E.newsContext([], [hot]));
ok(ah.hot === true && ah.signal === 'BEKLE', 'aşırı ısınan coin "güçlü al" almıyor (' + ah.signal + ', ' + ah.score + ')');

// Haber eşleştirme
const btc = d.coins[0];
const nc = E.newsContext([{ title: 'Bitcoin ETF inflows surge', link: 'x', source: 's', date: 1 }, { title: 'Bank of Somewhere opens', link: 'y', source: 's', date: 1 }], [btc]);
ok((nc.byCoin.bitcoin || []).length === 1, 'haber doğru coine eşleşiyor');


// ---- Rehber: uzun açıklamalar ve hisse analizi ----
const E2 = new Function(code + '; return { analyze, analyzeAll, makeDemo, narrateCoin, analyzeStock, narrateStock, makeDemoStocks, stockStats, COIN_INFO };')();
{
  const d2 = E2.makeDemo(); E2.analyzeAll(d2.coins, d2.news);
  const withInfo = d2.coins.filter((c) => E2.COIN_INFO[c.id]).length;
  ok(withInfo >= 30, 'demo coinlerinin ' + withInfo + ' tanesinde elle yazılmış tanıtım var');
  let bad = 0;
  for (const c of d2.coins) { const n = E2.narrateCoin(c, (v) => v.toFixed(2)); const txt = JSON.stringify(n); if (/undefined|NaN|\[object/.test(txt) || n.sec.length === 0 || n.risks.length < 2) { bad++; console.error('  sorunlu:', c.id, (txt.match(/.{20}(undefined|NaN|\[object).{20}/) || [''])[0]); } }
  ok(bad === 0, 'tüm coinlerin uzun açıklamaları eksiksiz ("undefined"/NaN yok)');
  const ds = E2.makeDemoStocks();
  let sbad = 0;
  for (const k of ['us', 'bist']) for (const s of ds.meta[k]) {
    const a = E2.analyzeStock(ds.hist[k][s.s], ds[k][s.s].c);
    const n = E2.narrateStock(s, a, (v) => v.toFixed(2));
    if (/undefined|NaN|\[object/.test(JSON.stringify(n)) || !a.signal) sbad++;
  }
  ok(sbad === 0, 'hisse analizi ve açıklamaları eksiksiz');
  const none = E2.analyzeStock(null, 1.2);
  ok(none.signal === 'VERİ YOK', 'geçmiş verisi olmayan hisse "VERİ YOK" alıyor, çökmüyor');
  ok(E2.narrateStock({ n: 'Test', s: 'X' }, none).sec.length === 1, 'verisiz hisse için dürüst açıklama');
  const spike = Array.from({ length: 80 }, (_, i) => 100 + i * 0.1); spike[79] = 125;
  const as = E2.analyzeStock(spike, 25);
  ok(as.hot && as.signal !== 'AL' && as.signal !== 'GÜÇLÜ AL', 'bir günde %25 sıçrayan hisse Al almıyor (' + as.signal + ')');
}
console.log(fail ? `\n${fail} test başarısız` : '\nTüm testler geçti (rehber dahil)');
process.exit(fail ? 1 : 0);
