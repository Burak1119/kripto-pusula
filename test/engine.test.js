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
const E4 = new Function(code + '; return { parseNumTr, groupNum, numField, portEncode, portDecode, portCalc, portSummary, buildStockWorld, makeDemoStocks, makeDemoStockNews };')();
{
  ok(E4.parseNumTr('0,05') === 0.05 && E4.parseNumTr('0.05') === 0.05, 'sayı okuma: 0,05 ve 0.05');
  ok(E4.parseNumTr('1.234.567,89') === 1234567.89 && E4.parseNumTr('1,234,567.89') === 1234567.89, 'sayı okuma: binlik ayraçlı');
  ok(E4.parseNumTr('₺ 12,5') === 12.5 && E4.parseNumTr('') === null && E4.parseNumTr('abc') === null && E4.parseNumTr('-3') === null, 'sayı okuma: simge, boş, bozuk, negatif');
  ok(E4.parseNumTr('10.000') === 10000 && E4.parseNumTr('1.234') === 1234 && E4.parseNumTr('100.000') === 100000 && E4.parseNumTr('0.500') === 0.5 && E4.parseNumTr('12.5') === 12.5, 'sayı okuma: 10.000 binlik, 0.500 ve 12.5 ondalık');
  ok(E4.groupNum('10000') === '10.000' && E4.groupNum('1234567,5') === '1.234.567,5' && E4.groupNum('0,05') === '0,05' && E4.groupNum('007') === '7' && E4.groupNum('5,') === '5,' && E4.groupNum('1.0000') === '10.000' && E4.groupNum('abc') === '' && E4.groupNum('1,2,3') === '1,23', 'binlik biçimi: gruplama, ondalık virgül, baştaki sıfır, fazla nokta/virgül');
  ok(E4.numField(10000) === '10.000' && E4.numField(0.05) === '0,05' && E4.numField('10000') === '10.000' && E4.numField('0.5') === '0,5' && E4.numField('') === '' && E4.numField(null) === '' && E4.numField(1234567.891) === '1.234.567,891', 'alana yazılacak sayı: binlik noktalı');
  ok([0, 5, 999, 1000, 12345, 123456789.25, 0.000123].every((n) => E4.parseNumTr(E4.numField(n)) === n), 'biçimlenen sayı geri aynen okunuyor');
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
// Kur, grafik, haber, sinyal değişimi, karne
const E5 = new Function(code + '; return { fxConv, portGrand, portSeries, portNews, portSignals, sigChanges, btNew, btStock, btCoin, btSummary, btBucket, makeDemoStocks, rng };')();
{
  const fx = { USD: 40, EUR: 50 };
  ok(E5.fxConv(100, 'USD', 'TRY', fx) === 4000 && E5.fxConv(100, 'TRY', 'EUR', fx) === 2 && E5.fxConv(10, 'EUR', 'USD', fx) === 12.5 && E5.fxConv(5, 'TRY', 'TRY', null) === 5, 'kur çevirisi doğru');
  ok(E5.fxConv(1, 'USD', 'TRY', null) === null && E5.fxConv(1, 'GBP', 'TRY', fx) === null, 'kur yoksa null (uydurma yok)');
  const g = E5.portGrand([{ cur: 'TRY', value: 1000, day: 10, hasDay: true }, { cur: 'EUR', value: 10, day: -1, hasDay: true }], fx, 'TRY');
  ok(g.value === 1500 && g.day === -40 && g.hasDay, 'tek toplam: 1000 ₺ + 10 € = 1500 ₺');
  ok(E5.portGrand([{ cur: 'EUR', value: 10, day: 0, hasDay: false }], { USD: 40 }, 'TRY') === null, 'kuru olmayan para birimi varsa tek toplam verilmiyor');
  const up = Array.from({ length: 20 }, (_, i) => 10 + i), dn = Array.from({ length: 30 }, (_, i) => 100 - i);
  const rows = [{ h: { qty: 2 }, it: { spark: up }, c: { cur: 'TRY' } }, { h: { qty: 1 }, it: { spark: dn }, c: { cur: 'USD' } }, { h: { qty: 5 }, it: null, c: { cur: 'TRY' } }];
  const ps = E5.portSeries(rows, fx, 'TRY');
  ok(ps.values.length === 20 && ps.used === 2 && ps.total === 3 && ps.values[19] === 2 * 29 + 71 * 40 && ps.values[0] === 2 * 10 + 90 * 40, 'portföy serisi: kısa olana hizalanıyor, fiyatı olmayan atlanıyor');
  const hit = (t, l, d, s) => ({ title: t, link: l, date: d, score: s, source: 'x' });
  const nr = E5.portNews([{ h: { sym: 'btc' }, it: { a: { hits: [hit('A', 'l1', 5, 1), hit('B', 'l2', 9, -1)] } } }, { h: { sym: 'eth' }, it: { a: { hits: [hit('A', 'l1', 5, 1)] } } }, { h: { sym: 'x' }, it: null }]);
  ok(nr.length === 2 && nr[0].title === 'B' && nr[1].tags.join() === 'BTC,ETH', 'portföy haberleri: yinelenen birleşti, yeniden eskiye sıralı');
  const sg = E5.sigChanges({ a: 'AL', b: 'BEKLE', c: 'SAT' }, { a: 'AZALT', b: 'BEKLE', c: 'AL', d: 'SAT' });
  ok(sg.length === 2 && sg.find((x) => x.id === 'a').worse === true && sg.find((x) => x.id === 'c').worse === false, 'sinyal değişimi: kötüleşen ve iyileşen ayrılıyor, yeni varlık sayılmıyor');
  ok(E5.portSignals([{ h: { id: 'q' }, it: { a: { signal: 'VERİ YOK' } } }, { h: { id: 'w' }, it: { a: { signal: 'AL' } } }]).q === undefined, 'verisiz sinyal kaydedilmiyor');
  // karne: yükselişi izleyen "al" sinyallerini içeren yapay seri
  const r = E5.rng(5); let v = 100; const cl = [];
  for (let i = 0; i < 200; i++) { v *= 1 + (r() - 0.48) * 0.03; cl.push(v); }
  const st = E5.btNew(); E5.btStock(cl, st, 5);
  ok(st.all.length === st.al.length + st.bekle.length + st.sat.length && st.all.length > 100 && st.all.every(Number.isFinite), 'karne (hisse): her gün tek gruba giriyor, değerler sayı (' + st.all.length + ' gözlem)');
  const sp = Array.from({ length: 1000 }, (_, i) => 100 * Math.exp(Math.sin(i / 90) * 0.2 + i * 0.0002));
  const cs = E5.btNew(); E5.btCoin(sp, { id: 'x', symbol: 'xyz', name: 'X', mcap: 1e10, vol: 1e9, rank: 20, ath: -20 }, cs);
  ok(cs.all.length > 20 && cs.all.length === cs.al.length + cs.bekle.length + cs.sat.length && cs.all.every(Number.isFinite), 'karne (coin): ' + cs.all.length + ' gözlem, hepsi sayı');
  const fake = { al: Array(40).fill(3), bekle: Array(40).fill(0), sat: Array(40).fill(-3), all: Array(120).fill(0) };
  const sm = E5.btSummary(fake);
  ok(sm.al === 'iyi' && sm.sat === 'iyi' && sm.r.al.up === 100, 'karne yorumu: al ortalamadan yüksek, sat düşükse "iyi"');
  const bad = E5.btSummary({ al: Array(40).fill(-3), bekle: [], sat: Array(10).fill(3), all: Array(50).fill(0) });
  ok(bad.al === 'ters' && bad.sat === 'az', 'karne yorumu: ters çalışan al "ters", az örnek "az"');
}
console.log(fail ? `\n${fail} test başarısız` : '\nTüm testler geçti (rehber dahil)');
process.exit(fail ? 1 : 0);
