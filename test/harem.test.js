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
// Trunçgil Finans akışı (gerçek yanıt biçimi: büyük harfli Buying/Selling, Type, Name, Change; ons 0 gelir)
const tg = { Update_Date: '2026-10-14 11:17:01',
  USD: { Buying: 49.3892, Type: 'Currency', Selling: 49.3949, Change: 0.03 }, EUR: { Buying: 55.3708, Type: 'Currency', Selling: 55.3807, Change: 0.07 },
  GRA: { Selling: 6598.41, Type: 'Gold', Name: 'GRAMALTIN', Change: -0.13, Buying: 6597.62 },
  CEYREKALTIN: { Buying: 10547.41, Selling: 10788.42, Change: 0, Type: 'Gold', Name: 'CEYREKALTIN' }, YARIMALTIN: { Buying: 21028.89, Selling: 21576.83, Change: 0, Type: 'Gold', Name: 'YARIMALTIN' },
  TAMALTIN: { Buying: 42189.63, Selling: 43021.7, Change: 0, Type: 'Gold', Name: 'TAMALTIN' }, CUMHURIYETALTINI: { Buying: 43726, Selling: 44389, Change: 0.02, Type: 'Gold', Name: 'CUMHURIYETALTINI' },
  ATAALTIN: { Buying: 43508.05, Selling: 44605.32, Change: 0, Type: 'Gold', Name: 'ATAALTIN' }, YIA: { Buying: 6012.02, Selling: 6017.76, Change: 0, Type: 'Gold', Name: '22AYARBILEZIK' },
  '14AYARALTIN': { Buying: 3757.51, Selling: 3761.1, Change: 0, Type: 'Gold', Name: '14AYARALTIN' }, '18AYARALTIN': { Buying: 4900, Selling: 4950, Change: 0, Type: 'Gold', Name: '18AYARALTIN' },
  ONS: { Buying: 0, Type: 'Gold', Name: 'ONS', Selling: 0, Change: -0.15 } };
const pt = H.parse(tg);
assert(pt && pt['fx:gold'].satis === 6598.41 && pt['fx:gold'].alis === 6597.62 && pt['fx:gold'].code === 'GRA', 'Trunçgil: gram altın GRA kodundan okundu');
assert(pt['fx:ceyrek'].satis === 10788.42 && pt['fx:yarim'].satis === 21576.83 && pt['fx:tam'].satis === 43021.7 && pt['fx:ata'].satis === 44605.32 && pt['fx:22'].satis === 6017.76 && pt['fx:14'].satis === 3761.1 && pt['fx:18'].satis === 4950, 'Trunçgil: çeyrek, yarım, tam, Ata, 22/14/18 ayar okundu');
assert(!pt['fx:ons'], 'Trunçgil: ons 0 geldiği için atlandı (hesaplanan kullanılır)');
console.log('ok   harem: Trunçgil akışı ayrıştırıldı');
const tt = Object.fromEntries(E.fxTable(49.39, 55.38, 4150, 0.4, pt).map((x) => [x.id, x]));
assert(tt['fx:gold'].src === 'harem' && tt['fx:gold'].price === 6598.41 && tt['fx:ceyrek'].src === 'harem' && !tt['fx:ons'].src, 'fiyat tablosu: akıştaki kalemler dış fiyatı aldı, ons hesaplandı');
console.log('ok   fiyat tablosu: Trunçgil fiyatı kullanıldı');
// ağ çağrısı: tek adres, bozuk yanıtta null
H._reset();
global.fetch = async (u) => { global.__u = u; return { ok: true, status: 200, text: async () => JSON.stringify(tg) }; };
(async () => {
  const d = await H.getHarem();
  assert(/finans\.truncgil\.com\/v4\/today\.json$/.test(global.__u) && d['fx:gold'].satis === 6598.41, 'getHarem akışı çekti ve ayrıştırdı');
  H._reset(); global.fetch = async () => ({ ok: false, status: 404, text: async () => '<html>yok</html>' });
  assert((await H.getHarem()) === null, '404 olunca null');
  H._reset(); global.fetch = async () => { throw new Error('ağ yok'); };
  assert((await H.getHarem()) === null, 'ağ hatasında null');
  console.log('ok   harem: ağ çağrısı, 404 ve ağ hatası');
})().catch((e) => { console.error(e); process.exit(1); });
