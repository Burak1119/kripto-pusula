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
// Hisse dünyası: Coin ve Hisse ayrı listeler, hisse haberleri şirketlerle eşleşiyor
const E3 = new Function(code + '; return { buildStockWorld, makeDemoStocks, makeDemoStockNews, analyzeAll, makeDemo };')();
{
  const raw = E3.makeDemoStocks(), news = E3.makeDemoStockNews();
  const w = E3.buildStockWorld(raw, news);
  ok(w.items.length === 6 && w.items.every((x) => x.kind === 'stock' && x.id.includes(':') && x.a && x.cur), 'hisse dünyası: 6 öğe, hepsi hisse, kimlikleri "pazar:sembol"');
  ok(w.items.every((x) => x.dom), 'her hissenin logo alan adı var');
  ok(w.items.some((x) => x.a.hits.length > 0), 'hisse haberleri şirketlerle eşleşti');
  ok(w.info.analyzed === 6 && typeof w.info.mood === 'string', 'hisse ruh hali hesaplandı (' + w.info.mood + ')');
  const dc = E3.makeDemo(); E3.analyzeAll(dc.coins, dc.news);
  ok(dc.coins.every((c) => !c.kind) && !w.items.some((x) => dc.coins.some((c) => c.id === x.id)), 'coin ve hisse kimlikleri karışmıyor');
  const w2 = E3.buildStockWorld({ meta: raw.meta, us: {}, bist: {}, hist: {}, ok: { midas: false, hist: false } }, []);
  ok(w2.items.length === 6 && w2.items.every((x) => x.a.signal === 'VERİ YOK' && x.price === null) && w2.info.analyzed === 0, 'hiç veri yokken de çökmüyor, "VERİ YOK" gösteriyor');
}
// Portföy hesapları
const E4 = new Function(code + '; return { parseNumTr, portEncode, portDecode, portCalc, portSummary, buildStockWorld, makeDemoStocks, makeDemoStockNews };')();
{
  ok(E4.parseNumTr('0,05') === 0.05 && E4.parseNumTr('0.05') === 0.05, 'sayı okuma: 0,05 ve 0.05');
  ok(E4.parseNumTr('1.234.567,89') === 1234567.89 && E4.parseNumTr('1,234,567.89') === 1234567.89, 'sayı okuma: binlik ayraçlı');
  ok(E4.parseNumTr('₺ 12,5') === 12.5 && E4.parseNumTr('') === null && E4.parseNumTr('abc') === null && E4.parseNumTr('-3') === null, 'sayı okuma: simge, boş, bozuk, negatif');
  const list = [
    { u: 'a', kind: 'coin', id: 'bitcoin', sym: 'btc', name: 'Bitcoin', qty: 0.0002, cost: 3000000, ccy: 'TRY', src: 'Binance', est: false },
    { u: 'b', kind: 'coin', id: 'ripple', sym: 'xrp', name: 'XRP', qty: 10, cost: null, ccy: 'TRY', src: 'Midas', est: true },
    { u: 'c', kind: 'stock', id: 'eu:DTE', sym: 'DTE', name: 'Deutsche Telekom', qty: 0.4, cost: null, ccy: 'EUR', src: 'Midas', est: true },
  ];
  const back = E4.portDecode('kp1.' + E4.portEncode(list));
  ok(back.length === 3 && back[0].qty === 0.0002 && back[0].cost === 3000000 && back[1].cost === null && back[1].est === true && back[2].kind === 'stock' && back[2].name === 'Deutsche Telekom', 'portföy kodu gidiş-dönüş (Türkçe karakter, null maliyet, yaklaşık işareti)');
  ok(E4.portDecode('#p=' + E4.portEncode(list)).length === 3, 'bağlantıdaki #p= kodu da okunuyor');
  ok(E4.portDecode('çöp') === null && E4.portDecode('') === null, 'bozuk kod null döner, çökmez');
  ok(E4.portDecode(E4.portEncode([{ kind: 'coin', id: 'x', sym: 'x', name: 'x', qty: -5, ccy: 'TRY' }, { kind: 'coin', id: 'y', sym: 'y', name: 'y', qty: 2, cost: 'zararlı', ccy: 'JPY' }])).length === 1, 'geçersiz miktar elenir, bozuk maliyet/para birimi düzeltilir');
  const c = E4.portCalc(list[0], { price: 4103736, c24: 2 });
  ok(Math.abs(c.value - 820.7472) < 0.01 && Math.abs(c.pl - 220.7472) < 0.01 && c.plp > 36 && c.plp < 37.5 && c.day > 0 && c.cur === 'TRY', 'BTC: değer, kâr/zarar ve günlük değişim doğru (' + c.plp.toFixed(1) + '%)');
  const nc = E4.portCalc(list[1], { price: 60, c24: -1 });
  ok(Math.abs(nc.value - 600) < 0.01 && nc.pl === null && nc.plp === null, 'maliyeti olmayan varlıkta kâr/zarar uydurulmuyor');
  const np = E4.portCalc(list[0], null);
  ok(np.value === null && np.pl === null && np.day === null, 'fiyatı olmayan varlıkta değer null');
  const eu = E4.portCalc(list[2], { price: 25.17, cur: 'EUR', c24: 1.2 });
  ok(eu.cur === 'EUR' && Math.abs(eu.value - 10.068) < 0.001, 'Avrupa hissesi: kesirli adet × euro fiyat');
  const sum = E4.portSummary([{ h: list[0], c }, { h: list[1], c: nc }, { h: list[2], c: eu }]);
  const t = sum.find((g) => g.cur === 'TRY'), e = sum.find((g) => g.cur === 'EUR');
  ok(sum.length === 2 && sum[0].cur === 'TRY' && Math.abs(t.value - (820.7472 + 600)) < 0.05 && t.noCost === 1 && Math.abs(t.pl - c.pl) < 1e-6 && e.pl === null, 'toplamlar para birimine göre ayrı, kâr/zarar yalnızca maliyeti bilinenlerden');
  const w = E4.buildStockWorld({ meta: { us: [], bist: [], eu: [{ s: 'DTE', n: 'Deutsche Telekom', k: 'Telekom', d: 'x', dom: 'telekom.com', al: [] }] }, us: {}, bist: {}, eu: { DTE: { p: 25.17, c: 1 } }, hist: {}, ok: {} }, []);
  ok(w.items.length === 1 && w.items[0].id === 'eu:DTE' && w.items[0].cur === 'EUR' && w.items[0].price === 25.17, 'Avrupa hissesi dünyaya giriyor: kimlik eu:DTE, para birimi EUR');
}
console.log(fail ? `\n${fail} test başarısız` : '\nTüm testler geçti (rehber dahil)');
process.exit(fail ? 1 : 0);
