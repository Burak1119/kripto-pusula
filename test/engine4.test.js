// Portföy risk puanı (saf motor).
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
const code = html.split('// ENGINE START')[1].split('// ENGINE END')[0];
const E = new Function(code + '; return { portRisk, portEncode, portDecode };')();
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
process.exit(fail ? 1 : 0);
