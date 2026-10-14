// Portföy risk puanı (saf motor).
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
const code = html.split('// ENGINE START')[1].split('// ENGINE END')[0];
const E = new Function(code + '; return { portRisk, portEncode, portDecode, fxTable, morningMessage, alertsRun };')();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('HATA:', m); } else console.log('ok  ', m); };
const row = (sym, value, risk, signal, hot) => ({ h: { sym }, c: { value, cur: 'TRY' }, it: { a: { risk, signal, hot: !!hot } } });
const FX = { TRY: 1, USD: 40, EUR: 46 };

let k = E.portRisk([row('btc', 1000, 'Yüksek', 'AL')], FX, 'TRY');
ok(k && k.n === 1 && k.score >= 70 && k.level === 'Çok yüksek', 'tek yüksek riskli varlık: çok yüksek risk (' + (k && k.score) + ')');
k = E.portRisk([row('a', 250, 'Düşük', 'AL'), row('b', 250, 'Düşük', 'BEKLE'), row('c', 250, 'Düşük', 'AL'), row('d', 250, 'Düşük', 'AL'), row('e', 100, 'Düşük', 'AL'), row('f', 100, 'Düşük', 'AL')], FX, 'TRY');
ok(k && k.level === 'Düşük' && k.score < 25, 'dengeli ve düşük riskli portföy: düşük (' + (k && k.score) + ')');
const a = E.portRisk([row('a', 500, 'Orta', 'AL'), row('b', 500, 'Orta', 'AL')], FX, 'TRY');
const b = E.portRisk([row('a', 500, 'Orta', 'SAT'), row('b', 500, 'Orta', 'AZALT')], FX, 'TRY');
ok(b.score > a.score, 'zayıf sinyaller puanı artırır (' + a.score + ' → ' + b.score + ')');
const c = E.portRisk([row('a', 500, 'Yüksek', 'AL'), row('usdt', 500, 'Düşük', 'STABİL')], FX, 'TRY');
const d = E.portRisk([row('a', 500, 'Yüksek', 'AL'), row('x', 500, 'Yüksek', 'AL')], FX, 'TRY');
ok(c.score < d.score, 'stabil varlık payı riski azaltır (' + c.score + ' < ' + d.score + ')');
ok(E.portRisk([], FX, 'TRY') === null && E.portRisk([{ h: { sym: 'x' }, c: { value: null, cur: 'TRY' }, it: null }], FX, 'TRY') === null, 'veri yoksa puan uydurulmaz');
ok(E.portRisk([{ h: { sym: 'x' }, c: { value: 10, cur: 'USD' }, it: { a: { risk: 'Orta', signal: 'AL' } } }], null, 'TRY') === null, 'kur yoksa farklı para birimi hesaplanmaz');
// grup alanı portföy koduyla taşınır
const code2 = E.portEncode([{ kind: 'coin', id: 'bitcoin', sym: 'btc', name: 'Bitcoin', qty: 1, cost: 5, ccy: 'TRY', src: 'Binance', est: false, grp: 'Uzun vade' }]);
const back = E.portDecode('kp1.' + code2);
ok(back && back[0].grp === 'Uzun vade', 'grup adı portföy koduyla taşınıyor');

// Altın ve döviz tablosu
const tb = E.fxTable(40, 46, 3110.35, 0.5), by = Object.fromEntries(tb.map((x) => [x.id, x]));
ok(Math.abs(by['fx:gold'].price - 4000) < 1e-6, 'gram altın = ons ÷ 31,1035 × dolar (4000)');
ok(Math.abs(by['fx:ceyrek'].price - 4000 * 1.75 * 0.916) < 1e-6 && Math.abs(by['fx:tam'].price - 4000 * 7 * 0.916) < 1e-6, 'çeyrek ve tam saf altın değerinden hesaplanır');
ok(Math.abs(by['fx:22'].price - 4000 * 0.916) < 1e-6 && Math.abs(by['fx:14'].price - 4000 * 0.585) < 1e-6, 'ayar fiyatları gram fiyatının oranı');
ok(by['fx:ons'].price === 3110.35 * 40 && by['fx:usd'].price === 40 && by['fx:eur'].price === 46 && by['fx:usd'].c24 === null, 'ons, dolar ve euro doğru; dövizde günlük değişim uydurulmaz');
ok(E.fxTable(40, 46, null).every((x) => !x.g) && E.fxTable(40, 46, null).length === 2, 'ons fiyatı yoksa altın kalemleri gösterilmez');
// Sabah özeti
const it = (c24, signal) => ({ a: { signal }, c24 });
const mm = E.morningMessage([{ name: 'A' }, { name: 'B' }, { name: 'C' }], (w) => ({ A: it(3, 'AL'), B: it(-5, 'SAT'), C: null })[w.name], tb);
ok(mm && mm.title.startsWith('Günaydın') && /En çok yükselen A \+3,0%/.test(mm.body) && /en çok düşen B −5,0%/.test(mm.body) && /Azalt\/Sat sinyali: B/.test(mm.body) && /Gram altın ₺4\.000,00/.test(mm.body), 'sabah özeti: en iyi, en kötü, zayıf sinyal, altın');
ok(E.morningMessage([], () => null, []) === null, 'veri yoksa sabah özeti uydurulmaz');
// Otomatik kural alarmı kendi notuyla çalar
const al = [{ u: 'x', k: 'c', id: 'b', sym: 'btc', name: 'Bitcoin', dir: 'dn', price: 90, ccy: 'TRY', n: 'maliyetinin %10 altına indi', done: null }];
const am = E.alertsRun(al, () => 80, 1);
ok(am.length === 1 && am[0].title === 'Bitcoin: maliyetinin %10 altına indi' && al[0].done === 1 && am[0].k === 'c' && am[0].id === 'b', 'otomatik kural alarmı notuyla ve açılacak varlık bilgisiyle çalar');
process.exit(fail ? 1 : 0);
