// Araçlar: keşke alsaydım, düzenli alım, karşılaştırma, ekonomi takvimi, haftalık rapor (saf motor).
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
const code = html.split('// ENGINE START')[1].split('// ENGINE END')[0];
const E = new Function(code + '; return { valNear, mulSeries, whatIf, dcaSim, seriesStats, ecoList, ecoBetween, ecoTomorrowMessage, weeklyMessage };')();
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('HATA:', m); } else console.log('ok  ', m); };
const D = 86400e3, t0 = Date.UTC(2025, 0, 1);
// 400 günlük, 100'den 300'e doğrusal yükselen seri
const t = Array.from({ length: 400 }, (_, i) => t0 + i * D), v = t.map((_, i) => 100 + i * 0.5);
ok(E.valNear(t, v, t0 + 10 * D + 3600e3) === v[10] && E.valNear(t, v, t0 - 30 * D, 5 * D) === null, 'en yakın nokta bulunur, çok uzaksa boş döner');
const fx = { t: t.filter((_, i) => i % 2 === 0), v: t.filter((_, i) => i % 2 === 0).map(() => 40) };
const m = E.mulSeries({ t, v }, fx);
ok(m.t.length === 400 && Math.abs(m.v[1] - v[1] * 40) < 1e-9, 'dolar fiyatı kurla çarpılıp TL serisine çevrilir (eksik günde en yakın kur)');
let w = E.whatIf(t, v, t0 + 100 * D, 1000);
ok(w && w.buy === v[100] && Math.abs(w.value - 1000 * v[399] / v[100]) < 1e-6 && Math.abs(w.pct - (v[399] / v[100] - 1) * 100) < 1e-9 && !w.short, 'keşke alsaydım: alış günü fiyatından bugünkü değer ve yüzde');
ok(w.low === 1000 && w.high > 1000, 'yoldaki en düşük ve en yüksek değer');
w = E.whatIf(t, v, t0 - 60 * D, 1000);
ok(w && w.short && w.date === t0, 'veri seçilen tarihten sonra başlıyorsa ilk günden hesaplanır ve belirtilir');
ok(E.whatIf(t, v, t0, 0) === null, 'tutar yoksa sonuç yok');
// düzenli alım: sabit fiyatta değer = yatırılan
const flat = t.map(() => 50), now = t[399];
let d = E.dcaSim(t, flat, 1000, 12, 1, now);
ok(d && d.n === 12 && d.invested === 12000 && Math.abs(d.value - 12000) < 1e-6 && Math.abs(d.avg - 50) < 1e-9, 'sabit fiyatta 12 ay: yatırılan = değer, ortalama maliyet = fiyat');
d = E.dcaSim(t, v, 1000, 12, 15, now);
ok(d && d.n === 12 && !d.short && d.value > d.invested && d.lump > d.value, 'yükselen piyasada düzenli alım kârlı ama tek seferde yatırmak daha kârlı');
ok(d.path.length > 300 && d.path[d.path.length - 1][1] === 12000, 'grafik için yatırılan/değer yolu çıkar');
d = E.dcaSim(t, v, 1000, 60, 1, now);
ok(d && d.short && d.n < 60 && d.n >= 13, 'veri yetmezse kaç ay hesaplandığı belirtilir');
const st = E.seriesStats(t, v);
ok(st && Math.abs(st.c30 - (v[399] / v[369] - 1) * 100) < 0.5 && st.dd === 0 && st.vol >= 0, 'karşılaştırma: dönem getirisi, düşüş olmayan seride 0 düşüş');
const zig = t.map((_, i) => (i === 200 ? 50 : 100));
ok(Math.round(E.seriesStats(t, zig).dd) === -50, 'en büyük düşüş zirveden dibe hesaplanır');
// takvim
const L = E.ecoList();
ok(L.length > 60 && L.every((x, i) => !i || L[i - 1].ts <= x.ts), 'takvim sıralı ve dolu');
const tc = L.find((x) => x.c === 'tcmb' && x.d === '2026-10-22');
ok(tc && new Date(tc.ts).toISOString() === '2026-10-22T11:00:00.000Z', 'TCMB 22 Ekim 14:00 (Türkiye) = 11:00 UTC');
const tu = L.filter((x) => x.c === 'tuik');
ok(tu.find((x) => x.d === '2027-01-04') && tu.find((x) => x.d === '2026-11-03') && tu.find((x) => x.d === '2027-04-05'), 'TÜİK: ayın 3\'ü, hafta sonuysa pazartesi');
let msg = E.ecoTomorrowMessage('2026-10-21');
ok(msg && /TCMB faiz kararı/.test(msg.title) && /14:00/.test(msg.body) && msg.k === 'r' && msg.id === 'cal', 'bir gün önce: yarınki olay bildirimi');
ok(E.ecoTomorrowMessage('2026-10-19') === null, 'yarın olay yoksa bildirim yok');
ok(E.ecoBetween('2026-10-26', 7).map((x) => x.c).join() === 'fed,ecb', 'hafta aralığındaki olaylar');
// haftalık rapor
const watch = [{ k: 'c', id: 'btc', name: 'Bitcoin' }, { k: 'c', id: 'eth', name: 'Ethereum' }, { k: 's', id: 'x', name: 'Yok' }];
const items = { btc: { c7: 5, a: { signal: 'AL' } }, eth: { c7: -3, a: { signal: 'SAT' } } };
msg = E.weeklyMessage(watch, (x) => items[x.id], '2026-10-25');
ok(msg && /ortalama \+1,0%/.test(msg.body) && /En iyi Bitcoin \+5,0%/.test(msg.body) && /Azalt\/Sat sinyali: Ethereum/.test(msg.body) && /Gelecek hafta: ABD Fed faiz kararı \(Çarşamba\)/.test(msg.body), 'haftalık rapor: ortalama, en iyi/kötü, zayıf sinyal, gelecek hafta');
ok(E.weeklyMessage([], () => null, '2026-10-25'), 'izlenen yoksa da takvimli rapor çıkar');
process.exit(fail ? 1 : 0);
