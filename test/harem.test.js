// Harem Altın ayrıştırıcısı ve fiyat tablosuna etkisi (sahte yanıtla).
const assert = require('assert');
const fs = require('fs'), path = require('path');
const H = require('../api/harem');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
const E = new Function(html.split('// ENGINE START')[1].split('// ENGINE END')[0] + '; return { fxTable };')();
const resp = { meta: { time: 1 }, data: {
  ALTIN: { code: 'ALTIN', alis: '3.570,10', satis: '3.575,40' }, KULCEALTIN: { alis: 3561.2, satis: '3.590,50' }, ONS: { alis: '2698,10', satis: '2699,90' },
  AYAR22: { alis: '3.250,00', satis: '3.300,00' }, CEYREK_YENI: { alis: '5.650,00', satis: '5.780,00' }, TAM_YENI: { alis: 22400, satis: 23100 }, ATA_YENI: { alis: 23100, satis: 23800 },
  USDTRY: { alis: '41,10', satis: '41,25' } } };
const p = H.parse(resp);
assert(p && p['fx:gold'].satis === 3590.5 && p['fx:gold'].code === 'KULCEALTIN', 'gram altın KULCEALTIN kodundan okundu');
assert(p['fx:ons'].satis === 2699.9 && p['fx:22'].alis === 3250 && p['fx:ceyrek'].satis === 5780 && p['fx:tam'].satis === 23100, 'virgüllü ve sayı biçimleri okundu');
assert(!p['fx:yarim'] && !p['fx:14'], 'sitede olmayan kalem atlandı');
console.log('ok   harem: yanıt ayrıştırıldı');
assert(H.parse({ data: { A: 1 } }) === null && H.parse(null) === null && H.parse({ x: { a: { satis: 1 } } }) === null, 'ok');
console.log('ok   harem: bozuk yanıt null döner');
const tb = Object.fromEntries(E.fxTable(41, 47, 2700, 0.4, p).map((x) => [x.id, x]));
assert(tb['fx:gold'].src === 'harem' && tb['fx:gold'].price === 3590.5 && tb['fx:gold'].alis === 3561.2, 'gram altın Harem fiyatını aldı');
assert(tb['fx:ons'].src === 'harem' && Math.abs(tb['fx:ons'].price - 2699.9 * 41) < 1e-6, 'ons dolar fiyatı TL’ye çevrildi');
assert(!tb['fx:yarim'].src && !tb['fx:18'].src && tb['fx:usd'].price === 41, 'olmayan kalemler hesaplanan değerde kaldı');
console.log('ok   fiyat tablosu: Harem fiyatı varsa o, yoksa hesap');
const bad = Object.fromEntries(E.fxTable(41, 47, 2700, 0.4, { 'fx:gold': { satis: 9999 }, 'fx:tam': { satis: 10 } }).map((x) => [x.id, x]));
assert(!bad['fx:gold'].src && !bad['fx:tam'].src && Math.abs(bad['fx:gold'].price - (2700 / 31.1035) * 41) < 1e-6, 'hesaplanandan %10’dan fazla ayrışan değer reddedildi');
console.log('ok   uç değerler reddedildi, hesaplanan fiyat kullanıldı');
