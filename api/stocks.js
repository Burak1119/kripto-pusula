// Hisseler: Midas'ın herkese açık canlı borsa sayfaları (fiyat, günlük değişim) ve
// Yahoo Finance'in herkese açık grafik verisi (geçmiş kapanışlar, analiz için).
// İkisi de resmi, anahtarlı bir API değildir. Biri çalışmazsa o kısım boş döner, diğerleri etkilenmez.
const MIDAS = 'https://www.getmidas.com';

// [sembol, ad, sektör, tanıtım]
const US = [
  ['AAPL', 'Apple', 'Teknoloji', 'iPhone, Mac ve iPad üreten, App Store ve iCloud gibi hizmetlerle de gelir elde eden ABD\'li teknoloji şirketi.'],
  ['MSFT', 'Microsoft', 'Teknoloji', 'Windows ve Office yazılımlarının, Azure bulut hizmetinin ve Xbox\'ın sahibi. Gelirinin büyük kısmı bulut ve kurumsal yazılımdan gelir.'],
  ['NVDA', 'Nvidia', 'Yarı iletken', 'Grafik işlemci (GPU) üreticisi. Yapay zeka eğitiminde kullanılan çipleriyle tanınır, bu yüzden yapay zeka haberlerine çok duyarlıdır.'],
  ['TSLA', 'Tesla', 'Otomotiv', 'Elektrikli araç ve batarya üreticisi. Fiyatı sık ve sert dalgalanır, şirketin liderine ilişkin haberlerden de etkilenir.'],
  ['AMZN', 'Amazon', 'E-ticaret / Bulut', 'Dünyanın en büyük online perakendecilerinden biri. Kârının önemli bir bölümü AWS bulut hizmetinden gelir.'],
  ['GOOGL', 'Alphabet (Google)', 'Teknoloji', 'Google arama motoru, YouTube ve Android\'in sahibi. Gelirinin büyük kısmı reklamdan gelir.'],
  ['META', 'Meta Platforms', 'Teknoloji', 'Facebook, Instagram ve WhatsApp\'ın sahibi. Gelirinin çoğu reklamdan gelir.'],
  ['AMD', 'AMD', 'Yarı iletken', 'Bilgisayar ve sunucu işlemcileri ile grafik kartları üreten çip şirketi. Intel ve Nvidia ile rekabet eder.'],
  ['NFLX', 'Netflix', 'Medya', 'Dünyanın en büyük abonelikli video yayın platformlarından biri.'],
  ['MSTR', 'MicroStrategy', 'Yazılım / Bitcoin', 'İş zekası yazılımı şirketi. Kasasına çok miktarda Bitcoin almasıyla bilinir, bu yüzden fiyatı Bitcoin\'e çok bağlıdır.'],
  ['COIN', 'Coinbase', 'Kripto borsası', 'ABD\'nin büyük kripto para borsalarından biri ve borsada işlem gören ilk büyük kripto şirketlerinden. Kripto piyasasıyla birlikte hareket eder.'],
  ['UBER', 'Uber', 'Ulaşım', 'Araç çağırma ve yemek teslimat platformu.'],
  ['WMT', 'Walmart', 'Perakende', 'Dünyanın en büyük market ve perakende zincirlerinden biri. Savunmacı (ekonomi kötüyken de satışı sürer) bir hisse sayılır.'],
  ['DIS', 'Disney', 'Medya', 'Film stüdyoları, Disney+ yayın platformu ve tema parklarının sahibi.'],
  ['KO', 'Coca-Cola', 'Gıda / İçecek', 'Dünyanın en büyük içecek markalarından biri. Düzenli temettü ödemesiyle bilinen, sakin seyirli bir hisse sayılır.'],
  ['JPM', 'JPMorgan Chase', 'Bankacılık', 'ABD\'nin en büyük bankası. Faiz oranları ve ekonomik büyüme beklentilerinden etkilenir.'],
  ['V', 'Visa', 'Ödeme sistemleri', 'Kart ödeme ağı işletir. Kendisi kredi vermez, her işlemden küçük bir komisyon alır.'],
  ['PLTR', 'Palantir', 'Yazılım', 'Devletlere ve büyük şirketlere veri analizi yazılımı satar. Yapay zeka beklentileriyle fiyatı sert oynar.'],
  ['INTC', 'Intel', 'Yarı iletken', 'Bilgisayar işlemcisi üreten köklü çip şirketi. Son yıllarda rekabette zorlanmıştır.'],
  ['BA', 'Boeing', 'Havacılık', 'Ticari uçak ve savunma sanayii ürünleri üretir. Üretim ve güvenlik haberlerine duyarlıdır.'],
];
const BIST = [
  ['THYAO', 'Türk Hava Yolları', 'Ulaşım', 'Türkiye\'nin bayrak taşıyıcı havayolu şirketi. Yakıt fiyatı, döviz kuru ve turizm hareketliliğinden etkilenir.'],
  ['ASELS', 'Aselsan', 'Savunma', 'Türkiye\'nin savunma elektroniği alanındaki büyük şirketi. Savunma ihaleleri ve sipariş haberleri fiyatı etkiler.'],
  ['BIMAS', 'BİM Mağazalar', 'Perakende', 'Türkiye\'nin büyük indirim marketi zinciri. Gıda satışı ekonomi kötüyken de sürdüğü için savunmacı sayılır.'],
  ['KCHOL', 'Koç Holding', 'Holding', 'Türkiye\'nin en büyük sanayi gruplarından biri. Enerji, otomotiv ve finans şirketlerinde pay sahibidir.'],
  ['GARAN', 'Garanti BBVA', 'Bankacılık', 'Türkiye\'nin büyük özel bankalarından biri. Faiz kararları ve kredi büyümesinden etkilenir.'],
  ['AKBNK', 'Akbank', 'Bankacılık', 'Türkiye\'nin büyük özel bankalarından biri.'],
  ['ISCTR', 'İş Bankası (C)', 'Bankacılık', 'Türkiye\'nin en büyük bankalarından biri. C grubu hisseleri borsada işlem görür.'],
  ['YKBNK', 'Yapı Kredi', 'Bankacılık', 'Koç Grubu\'na bağlı büyük özel bankalardan biri.'],
  ['EREGL', 'Ereğli Demir Çelik', 'Demir çelik', 'Türkiye\'nin büyük demir çelik üreticisi. Çelik fiyatları ve ihracat talebinden etkilenir.'],
  ['TUPRS', 'Tüpraş', 'Enerji', 'Türkiye\'nin en büyük petrol rafinerisi işletmecisi. Petrol fiyatları ve rafineri marjı fiyatı etkiler.'],
  ['SASA', 'SASA Polyester', 'Kimya', 'Polyester ve kimyasal hammadde üreticisi. Fiyatı genelde sert hareket eder.'],
  ['FROTO', 'Ford Otosan', 'Otomotiv', 'Ford ve Koç Grubu ortaklığı. Ticari araç üretimi ve ihracatı güçlüdür.'],
  ['TOASO', 'Tofaş', 'Otomotiv', 'Fiat ve Koç Grubu ortaklığıyla otomobil ve hafif ticari araç üretir.'],
  ['SISE', 'Şişecam', 'Cam / Sanayi', 'Cam ürünleri üretiminde dünyanın büyük oyuncularından biri.'],
  ['PGSUS', 'Pegasus', 'Ulaşım', 'Düşük maliyetli havayolu şirketi. Yakıt fiyatı ve döviz kuru fiyatı etkiler.'],
  ['TCELL', 'Turkcell', 'Telekomünikasyon', 'Türkiye\'nin büyük mobil operatörlerinden biri.'],
  ['ARCLK', 'Arçelik', 'Dayanıklı tüketim', 'Beyaz eşya üreticisi. Arçelik, Beko ve birçok markanın sahibidir.'],
  ['PETKM', 'Petkim', 'Kimya', 'Türkiye\'nin petrokimya üreticisi. Petrol ve kimya fiyatlarından etkilenir.'],
  ['KRDMD', 'Kardemir', 'Demir çelik', 'Karabük merkezli demir çelik üreticisi.'],
  ['HEKTS', 'Hektaş', 'Tarım kimyasalları', 'Tarım ilacı ve gübre üreten şirket.'],
  ['EKGYO', 'Emlak Konut GYO', 'Gayrimenkul', 'Konut projeleri geliştiren gayrimenkul yatırım ortaklığı.'],
  ['KOZAL', 'Koza Altın', 'Madencilik', 'Altın madeni işleten şirket. Altın fiyatından güçlü etkilenir.'],
  ['ENKAI', 'Enka İnşaat', 'İnşaat / Enerji', 'Büyük altyapı projeleri üstlenen inşaat ve enerji şirketi.'],
  ['ASTOR', 'Astor Enerji', 'Enerji ekipmanı', 'Trafo ve elektrik dağıtım ekipmanı üreticisi.'],
];
const meta = () => ({
  us: US.map(([s, n, k, d]) => ({ s, n, k, d })),
  bist: BIST.map(([s, n, k, d]) => ({ s, n, k, d })),
});

const strip = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const trNum = (s) => { const n = Number(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Midas hisse listesi: bağlantı kalıbı /{taban}/{sembol}-hisse/
function parseMidasStocks(html, base) {
  const out = {};
  const re = new RegExp('<a\\b[^>]*href="(?:https?:\\/\\/(?:www\\.)?getmidas\\.com)?\\/' + base + '\\/([a-z0-9][a-z0-9.-]*)-hisse\\/?"[^>]*>([\\s\\S]*?)<\\/a>', 'gi');
  const hits = [];
  let m;
  while ((m = re.exec(html))) hits.push({ slug: m[1], inner: m[2], start: m.index, end: re.lastIndex });
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i], sym = h.slug.toUpperCase();
    if (out[sym]) continue;
    const next = hits.findIndex((x, j) => j > i && x.slug !== h.slug);
    const stop = next === -1 ? h.end + 1200 : hits[next].start;
    // Fiyat bağlantının içinde de dışında da olabilir; sembolün kendisindeki rakamlar (ör. A1CAP) karışmasın diye çıkarılır.
    const seg = strip(h.inner + ' ' + html.slice(h.end, Math.min(stop, h.end + 1200))).replace(/−/g, '-')
      .replace(new RegExp('(^|[^A-Za-z0-9])' + sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9])', 'gi'), ' ');
    const pm = seg.match(/\$\s?(\d[\d.]*(?:,\d+)?)/) || seg.match(/(\d[\d.]*(?:,\d+)?)/);
    const cm = seg.match(/([-+]?\s?\d+(?:,\d+)?)\s?%/);
    const p = pm ? trNum(pm[1]) : null;
    if (p === null) continue;
    out[sym] = { p, c: cm ? trNum(cm[1].replace(/\s/g, '').replace('+', '')) : null };
  }
  return out;
}

async function page(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'KriptoPusula/1.0 (kisisel kullanim)', accept: 'text/html' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.text();
}
async function getMidas() {
  const [b, u] = await Promise.allSettled([
    page(MIDAS + '/canli-borsa/').then((h) => parseMidasStocks(h, 'canli-borsa')),
    Promise.any([MIDAS + '/amerikan-borsasi/', MIDAS + '/abd-borsalari/'].map((x) => page(x).then((h) => parseMidasStocks(h, 'amerikan-borsasi')))),
  ]);
  return {
    bist: b.status === 'fulfilled' ? b.value : {},
    us: u.status === 'fulfilled' ? u.value : {},
    ok: b.status === 'fulfilled' && Object.keys(b.value).length > 0 || u.status === 'fulfilled' && Object.keys(u.value).length > 0,
  };
}

function parseYahoo(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  const q = r && r.indicators && r.indicators.quote && r.indicators.quote[0];
  if (!q || !q.close) return null;
  const c = q.close.filter((v) => typeof v === 'number' && v > 0).map((v) => Number(v.toPrecision(6)));
  return c.length >= 20 ? c : null;
}
async function getHist(list, suffix) {
  const out = {};
  for (let i = 0; i < list.length; i += 8) {
    await Promise.allSettled(list.slice(i, i + 8).map(async ([s]) => {
      const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s + suffix) + '?range=6mo&interval=1d',
        { headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('Yahoo ' + r.status);
      const c = parseYahoo(await r.json());
      if (c) out[s] = c;
    }));
  }
  return out;
}

let live = { ts: 0, bist: {}, us: {}, ok: false };
let hist = { ts: 0, us: {}, bist: {} };
async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=120');
  if (Date.now() - live.ts > 60 * 1000) {
    try { const m = await getMidas(); live = { ts: Date.now(), ...m }; } catch (e) { live.ts = Date.now(); live.ok = false; }
  }
  if (Date.now() - hist.ts > 30 * 60 * 1000) {
    const [u, b] = await Promise.all([getHist(US, ''), getHist(BIST, '.IS')]);
    hist = { ts: Date.now(), us: Object.keys(u).length ? u : hist.us, bist: Object.keys(b).length ? b : hist.bist };
  }
  res.end(JSON.stringify({ updated: live.ts, meta: meta(), us: live.us, bist: live.bist, hist: { us: hist.us, bist: hist.bist }, ok: { midas: live.ok, hist: Object.keys(hist.us).length + Object.keys(hist.bist).length > 0 } }));
}
module.exports = handler;
module.exports.parseMidasStocks = parseMidasStocks;
module.exports.parseYahoo = parseYahoo;
module.exports.meta = meta;
