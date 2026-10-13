const assert = require('assert');
const st = require('../api/stocks');
const bist = `<table><tr><td><a href="/canli-borsa/thyao-hisse/">THYAO</a></td><td>312,50</td><td>-1,20%</td></tr>
<tr><td><a href="https://www.getmidas.com/canli-borsa/asels-hisse/"><img></a><a href="https://www.getmidas.com/canli-borsa/asels-hisse/">ASELS</a></td><td>1.205,75</td><td>+2,05%</td></tr>
<tr><td><a href="/canli-borsa/en-cok-islem-goren-hisseler">En çok</a></td></tr></table>`;
const b = st.parseMidasStocks(bist, 'canli-borsa');
assert.deepStrictEqual(b.THYAO, { p: 312.5, c: -1.2 });
assert.deepStrictEqual(b.ASELS, { p: 1205.75, c: 2.05 });
assert.strictEqual(Object.keys(b).length, 2);
console.log('ok   midas BIST: fiyat/değişim okundu, hisse olmayan bağlantı atlandı');
const us = `<ul><li><a href="/amerikan-borsasi/aapl-hisse/">AAPL Apple Inc. $333,60 -2%</a></li>
<li><a href="/amerikan-borsasi/nvda-hisse/"><b>NVDA</b> Nvidia Corp</a> $234,61 <span>1,79%</span></li></ul>`;
const u = st.parseMidasStocks(us, 'amerikan-borsasi');
assert.strictEqual(u.NVDA.p, 234.61); assert.strictEqual(u.NVDA.c, 1.79);
console.log('ok   midas ABD: biçim farkına dayanıklı (bağlantı içi/dışı fiyat)', JSON.stringify(u.AAPL));
const c = st.parseYahoo({ chart: { result: [{ indicators: { quote: [{ close: [1, null, ...Array.from({ length: 30 }, (_, i) => 10 + i)] }] } }] } });
assert.strictEqual(c.length, 31);
assert.strictEqual(st.parseYahoo({ chart: { result: null } }), null);
console.log('ok   yahoo: boş değerler atıldı, bozuk yanıt null');
const m = st.meta(); assert(m.us.length >= 15 && m.bist.length >= 15 && m.us.every((x) => x.d.length > 20));
for (const k of ['SAHOL', 'ALBRK', 'KTLEV']) assert(m.bist.some((x) => x.s === k && x.dom && x.d.length > 20), k + ' BIST listesinde olmalı');
assert(m.eu.length >= 1 && m.eu[0].s === 'DTE' && m.eu[0].dom, 'Avrupa listesinde DTE olmalı');
console.log('ok   meta:', m.us.length, 'ABD,', m.bist.length, 'BIST hissesi, hepsinde tanıtım var');
const a1 = st.parseMidasStocks('<a href="/canli-borsa/a1cap-hisse/">A1CAP</a> <td>4,19</td> <td>-3,90%</td>', 'canli-borsa');
assert.deepStrictEqual(a1.A1CAP, { p: 4.19, c: -3.9 });
console.log('ok   A1CAP: sembolün içindeki rakam fiyat sanılmadı');
assert.deepStrictEqual(u.AAPL, { p: 333.6, c: -2 });
console.log('ok   AAPL: fiyat bağlantı içinde olsa da okundu');
