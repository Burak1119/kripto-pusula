// İşlem kaydı, dağılım, haftalık özet ve bildirim kuralları (saf motor).
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
const code = html.split('// ENGINE START')[1].split('// ENGINE END')[0];
const E = new Function(code + '; return { txApply, txCommit, txAdd, txRemove, portRealized, portConc, portWeek, portEncode, portDecode, portCalc, alertDir, alertHit, alertsRun, watchMessages, fmtMoney };')();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('HATA:', m); } else console.log('ok  ', m); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

// Ortalama maliyet
let r = E.txApply([{ t: 'b', q: 10, p: 100 }, { t: 'b', q: 10, p: 200 }]);
ok(r.ok && r.qty === 20 && near(r.cost, 150) && r.real === null, 'iki alıştan ortalama maliyet 150');
r = E.txApply([{ t: 'b', q: 10, p: 100 }, { t: 'b', q: 10, p: 200 }, { t: 's', q: 5, p: 180 }]);
ok(r.ok && r.qty === 15 && near(r.cost, 150) && near(r.real, 5 * 30), 'satış ortalamayı değiştirmez, kâr (180-150)*5 = 150');
r = E.txApply([{ t: 'b', q: 4, p: 50 }, { t: 's', q: 4, p: 40 }]);
ok(r.ok && r.qty === 0 && r.cost === null && near(r.real, -40), 'tamamı satılınca miktar 0, zarar -40');
ok(!E.txApply([{ t: 'b', q: 1, p: 1 }, { t: 's', q: 2, p: 1 }]).ok, 'eldekinden fazla satış reddedilir');
r = E.txApply([{ t: 'b', q: 2, p: null }, { t: 'b', q: 2, p: 10 }]);
ok(r.ok && r.qty === 4 && r.cost === null, 'maliyeti bilinmeyen alış varsa ortalama maliyet uydurulmaz');
r = E.txApply([{ t: 'b', q: 0.1, p: 3 }, { t: 's', q: 0.1, p: 4 }]);
ok(r.qty === 0, 'ondalık tam satışta kalıntı kalmaz');
r = E.txApply([{ t: 'b', q: 3, p: 10 }, { t: 's', q: 1, p: null }]);
ok(r.ok && r.real === null && r.qty === 2 && near(r.cost, 10), 'satış fiyatı yoksa gerçekleşen kâr hesaplanmaz');

// Kayıt üzerinde işlem ekleme / silme
const h = { kind: 'coin', id: 'bitcoin', sym: 'btc', name: 'Bitcoin', qty: 2, cost: 100, ccy: 'TRY' };
ok(E.txAdd(h, { t: 'b', q: 2, p: 200, d: '2026-10-01' }) === null && h.qty === 4 && near(h.cost, 150) && h.tx.length === 2, 'mevcut kayıt açılış işlemi sayılıp alış eklenir');
ok(E.txAdd(h, { t: 's', q: 9, p: 1 }) !== null && h.qty === 4, 'geçersiz satışta kayıt değişmez');
ok(E.txAdd(h, { t: 's', q: 1, p: 250 }) === null && h.qty === 3 && near(h.real, 100), 'satış sonrası kayıt güncellenir');
ok(E.txRemove(h, 2) === null && h.qty === 4 && h.real === null, 'satışı silince geri alınır');
ok(E.txRemove(h, 0) === null && h.qty === 2 && near(h.cost, 200), 'ilk alış silinince kalan işlemlerden yeniden hesaplanır');
ok(E.portRealized([{ kind: 'coin', real: 10 }, { kind: 'stock', ccy: 'USD', real: -4 }, { kind: 'coin', real: null }, { kind: 'coin', real: 5 }]).TRY === 15, 'gerçekleşen kâr para birimine göre toplanır');

// Kod: işlemler gidip gelir, eski kod (işlemsiz) hâlâ okunur
const hh = { kind: 'coin', id: 'ethereum', sym: 'eth', name: 'Ethereum', qty: 1, cost: 10, ccy: 'TRY' };
E.txAdd(hh, { t: 'b', q: 1, p: 30, d: '2026-10-02' }); E.txAdd(hh, { t: 's', q: 1, p: 40, d: '2026-10-03' });
const back = E.portDecode(E.portEncode([hh]))[0];
ok(back.qty === 1 && near(back.cost, 20) && near(back.real, 20) && back.tx.length === 3 && back.tx[2].t === 's', 'portföy kodu işlemleri ve gerçekleşen kârı taşıyor');
const closed = { kind: 'stock', id: 'bist:X', sym: 'X', name: 'X', qty: 1, cost: 5, ccy: 'TRY' }; E.txAdd(closed, { t: 's', q: 1, p: 9 });
const cb = E.portDecode(E.portEncode([closed]));
ok(cb.length === 1 && cb[0].qty === 0 && near(cb[0].real, 4), 'tamamen satılmış kayıt da (miktar 0) kodla taşınıyor');
const old = E.portEncode([{ kind: 'coin', id: 'a', sym: 'a', name: 'A', qty: 2, cost: 3, ccy: 'TRY' }]);
ok(E.portDecode(old)[0].qty === 2 && !E.portDecode(old)[0].tx, 'işlemsiz eski kod aynen okunuyor');
const evil = JSON.stringify([['c', 'x', 'x', 'X', 1, 1, 'TRY', '', 0, [['s', 5, 1, '']]]]);
const evilCode = Buffer.from(evil).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
ok(E.portDecode(evilCode)[0].qty === 1 && !E.portDecode(evilCode)[0].tx, 'bozuk işlem listesi atılır, kayıt miktarla kalır');

// Dağılım ve haftalık özet
const mk = (sym, value, cur, c7, spark) => ({ h: { id: sym, sym, qty: 1 }, c: { value, cur }, it: { c7, spark } });
const rows = [mk('btc', 600, 'TRY', 5), mk('eth', 300, 'TRY', -2), mk('xrp', 100, 'TRY', 9)];
const cn = E.portConc(rows, null, 'TRY');
ok(cn.sym === 'btc' && near(cn.share, 60) && near(cn.top2, 90), 'dağılım: en büyük %60, ilk iki %90');
ok(E.portConc([mk('a', 1, 'TRY', 0)], null, 'TRY') === null, 'tek varlıkta dağılım uyarısı yok');
ok(E.portConc([mk('a', 1, 'TRY', 0), mk('b', 1, 'USD', 0)], null, 'TRY') === null, 'kur yoksa dağılım hesaplanmaz');
ok(near(E.portConc([mk('a', 100, 'TRY', 0), mk('b', 1, 'USD', 0)], { USD: 100 }, 'TRY').share, 50), 'kurla çevrilince pay doğru');
const wk = E.portWeek([mk('a', 10, 'TRY', 5, [10, 11, 12, 13, 14, 15, 16, 17, 18, 20]), mk('b', 5, 'TRY', -3, [5, 5, 5, 5, 5, 5, 5, 5, 5, 5])].map((x) => { x.h.qty = 1; return x; }), null, 'TRY', 'coin');
ok(wk && near(wk.from, 15) && near(wk.to, 25) && near(wk.pct, 66.666666) && wk.best.h.sym === 'a' && wk.worst.h.sym === 'b', 'haftalık özet: değişim ve en iyi/en kötü');
const sr = mk('a', 10, 'TRY', 5, [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 4]); sr.h.qty = 1;
const wst = E.portWeek([sr], null, 'TRY', 'stock');
ok(wst && wst.from === 2 && wst.to === 4 && near(wst.pct, 100), 'hissede yalnızca son 6 değer (5 işlem günü) kullanılır');

// Fiyat alarmı
ok(E.alertDir(110, 100) === 'up' && E.alertDir(90, 100) === 'dn', 'alarm yönü hedefe göre kendiliğinden seçiliyor');
ok(E.alertHit({ dir: 'up', price: 100 }, 100) && !E.alertHit({ dir: 'up', price: 100 }, 99.9) && E.alertHit({ dir: 'dn', price: 100 }, 99) && !E.alertHit({ dir: 'dn', price: 100, done: 5 }, 1) && !E.alertHit({ dir: 'up', price: 100 }, null), 'alarm tetikleme sınırları');
const al = [{ u: 'a1', name: 'Bitcoin', sym: 'btc', dir: 'up', price: 4000000, ccy: 'TRY' }, { u: 'a2', name: 'Apple', sym: 'AAPL', dir: 'dn', price: 150, ccy: 'USD' }];
const am = E.alertsRun(al, (a) => (a.u === 'a1' ? 4100000.5 : 160), 777);
ok(am.length === 1 && al[0].done === 777 && !al[1].done && /Bitcoin/.test(am[0].title) && /4\.100\.000,50/.test(am[0].body), 'tetiklenen alarm bir kez çalıyor, işaretleniyor, mesajda tutar var');
ok(E.alertsRun(al, (a) => (a.u === 'a1' ? 9e9 : 100), 888).length === 1 && al[0].done === 777 && al[1].done === 888, 'çalmış alarm tekrar çalmaz, henüz çalmamış olan çalar');

// Sinyal / sert hareket bildirimi
const W = [{ id: 'a', name: 'AAA' }, { id: 'b', name: 'BBB' }, { id: 'c', name: 'CCC' }];
const items = { a: { c24: 1, a: { signal: 'SAT', reasons: [{ pos: false, t: 'Trend düşüyor.' }] } }, b: { c24: -9.5, a: { signal: 'BEKLE', reasons: [] } }, c: { c24: 2, a: { signal: 'AL', reasons: [] } } };
let wm = E.watchMessages(W, (w) => items[w.id], { a: 'AL', b: 'BEKLE', c: 'BEKLE' }, {}, '2026-10-13');
ok(wm.msgs.length === 2 && /AAA: sinyal SAT/.test(wm.msgs[0].title) && /Trend düşüyor/.test(wm.msgs[0].body) && /BBB bugün −9,5%/.test(wm.msgs[1].title), 'kötüleşen sinyal ve sert hareket bildirilir, iyileşen (c) bildirilmez');
const wm2 = E.watchMessages(W, (w) => items[w.id], wm.sigs, wm.done, '2026-10-13');
ok(wm2.msgs.length === 0, 'aynı gün ikinci kontrolde tekrar bildirmez');
const wm3 = E.watchMessages(W, (w) => items[w.id], wm.sigs, wm.done, '2026-10-14');
ok(wm3.msgs.length === 1 && /BBB/.test(wm3.msgs[0].title), 'ertesi gün sert hareket yine bildirilir, eski gün kayıtları temizlenir');
ok(E.watchMessages(W, () => null, {}, {}, 'x').msgs.length === 0, 'verisi olmayan varlık sessizce atlanır');
const gen = fs.readFileSync(path.join(__dirname, '..', 'api', '_engine.js'), 'utf8');
ok(gen.includes(JSON.stringify(code + '\n;return').slice(1, -1)), 'api/_engine.js uygulamadaki motorla aynı (güncel değilse: python3 build.py)');
console.log(fail ? fail + ' hata' : 'Tüm motor testleri geçti');
process.exit(fail ? 1 : 0);
