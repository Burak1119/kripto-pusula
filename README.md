# Kripto Pusula

Kripto piyasasını ve seçilmiş BIST + ABD hisselerini tarayan, haberleri okuyan ve her biri için **Güçlü Al / Al / Bekle / Azalt / Sat** önerisi üreten bir karar destek uygulaması. Aynı kodla web sitesi olarak çalışır, telefonda ana ekrana eklenince uygulama gibi açılır.

Uygulama senin yerine işlem **yapmaz**. Sadece analiz eder ve gerekçesiyle öneri verir.

## Nasıl çalışır

- **Coin / Hisse seçimi:** Uygulama her açılışta "Coin mi Hisse mi?" diye sorar. İkisi birbirinden ayrıdır: kendi Pano, Piyasa, Haberler ve Rehber sekmeleri, kendi renk teması ve kendi haber kaynakları vardır. Üstteki düğmeyle istediğin an diğerine geçilir, sol üstteki isme basınca seçim ekranına dönülür.
- **Fiyat verisi:** CoinGecko (ilk 500 coin, 7 günlük fiyat grafiği, 1sa/24sa/7g/30g değişim, hacim).
- **Borsalar:** Binance (herkese açık piyasa verisi, anahtar gerekmez) ve Midas (getmidas.com/canli-kripto sayfasındaki herkese açık tablo). Midas'ın resmi bir API'si olmadığı için sayfa tasarımı değişirse Midas bölümü boş kalabilir, uygulamanın geri kalanı etkilenmez. Bir satıra basınca ilgili borsanın coin sayfası açılır.
- **Rehber sekmesi:** Her coin için ne olduğu, uzun analiz, riskler ve Midas/Binance canlı fiyatı. ABD ve BIST hisseleri için de aynısı: fiyatlar Midas'ın herkese açık sayfalarından, geçmiş fiyat (analiz için) Yahoo Finance'in herkese açık grafik verisinden gelir. Bu iki kaynak da resmi bir API değildir; çalışmazsa ilgili kısım boş kalır, uygulama çalışmaya devam eder.
- **Haberler:** Coin için CoinDesk, Cointelegraph (EN ve TR), Decrypt, The Block. Hisse için Yahoo Finance, CNBC, MarketWatch, Bloomberg HT, AA Ekonomi RSS yayınları; başlıklar şirket adı ve sembolüne göre hisselerle eşleştirilir.
- **Portföy sekmesi:** Elindeki coin ve hisseleri miktarıyla (isteğe bağlı alış maliyetiyle) girersin; toplam değer, bugünkü değişim, kâr/zarar, dağılım çubuğu ve her varlığın Al/Bekle/Sat sinyali görünür. Sat/Azalt veren ya da aşırı ısınmış varlıkların altında uyarı çıkar. Girdiğin bilgiler **yalnızca cihazında** saklanır (tarayıcı belleği), sunucuya gönderilmez. Başka cihaza taşımak için sayfanın altındaki kodu kopyala-yapıştır yap ya da `.../#p=KOD` biçimindeki bağlantıyı aç. Coin değerleri TL, hisseler kendi para biriminde (₺, $, €) gösterilir; farklı para birimleri güncel kurla (yaklaşık) tek toplamda birleştirilir; ₺ / $ / € düğmeleriyle toplamın para birimi seçilir. Portföyün değer geçmişi grafiği, elindekilerle ilgili haberler ve bildirim ayarı da bu sekmededir.
- **Bugün senin için (Pano):** portföyün günlük değişimi, en çok oynayanlar, son açılıştan beri sinyali değişenler, uyarılar ve ilgili haber sayısı.
- **Sinyal karnesi (Pano):** uygulamanın Al / Bekle / Sat sinyallerinin geçmişte işe yarayıp yaramadığını (1 hafta sonrası fiyat) kendi geçmiş verisiyle sınar. Haber puanı karneye dahil değildir; geleceği garanti etmez.
- **Küçük coinler:** ana alım adayları yalnızca ilk 100 coinden seçilir; sırası 100'ün dışındakiler ayrı bir "Riskli ama hareketli" kutusunda uyarıyla gösterilir.
- **Bildirimler:** sinyali Azalt/Sat'a dönen ya da bir günde %8'den fazla oynayan varlıklar için bildirim. Uygulama açıkken ya da arka planda canlıyken çalışır; uygulama tamamen kapalıyken bildirim için ayrı bir sunucu servisi gerekir. iPhone'da önce Ana Ekrana eklemek gerekir.
- **Fiyat alarmı:** bir varlığın ayrıntı penceresinin altından hedef fiyat yazılır; yön (yukarı/aşağı) kendiliğinden belirlenir. Ulaşılınca bildirim ve ekranda uyarı gelir (bir kez çalar, istenirse yeniden kurulur).
- **İşlem geçmişi:** Portföyde bir varlığa basınca alış/satış işlemleri eklenir. Ortalama maliyet kendiliğinden hesaplanır, satışlarda gerçekleşen kâr/zarar görünür. İşlemler portföy koduna dahildir.
- **Dağılım uyarısı, "Bu hafta" kartı:** tek varlıkta yoğunlaşma uyarısı ve son 1 haftanın portföy özeti.
- **Haber çevirisi:** İngilizce başlıklar otomatik çevrilir (Haberler sekmesinden kapatılır). Çeviri resmî olmayan, anahtarsız servislerle yapılır; çalışmazsa orijinal başlık görünür. Puanlama her zaman orijinal başlıkla yapılır.
- **Uygulama kapalıyken bildirim:** `KURULUM.md` dosyasındaki 5 adım (Redis + üç değişken + zamanlayıcı). Kurulmazsa bildirimler yalnızca uygulama açıkken çalışır.
- **Logolar:** Coin logoları CoinGecko'dan, hisse logoları şirketlerin kendi sitelerinin simgesinden (Google, olmazsa DuckDuckGo) gelir. Bulunamazsa harfler gösterilir.
- **Puan (-100 ile +100):** 7 ve 30 günlük momentum, 24 saatlik hareket, fiyatın 7 günlük ortalamaya göre yeri, RSI, hacim/piyasa değeri oranı, coin büyüklüğü ve haber başlıklarının tonu.
- **Koruma:** Çok sert yükselmiş ya da RSI'ı aşırı alım bölgesinde olan coin "aşırı ısınmış" sayılır ve asla Al sinyali almaz.
- **Risk seviyesi:** günlük oynaklığa ve piyasa değerine göre Düşük / Orta / Yüksek.

## Telefonda ve internette yayınlama (Vercel, ücretsiz)

1. https://github.com adresinde hesap aç, yeni bir depo (repository) oluştur ve bu klasördeki tüm dosyaları yükle.
2. https://vercel.com adresine GitHub hesabınla giriş yap, **Add New > Project** de, depoyu seç, **Deploy** düğmesine bas.
3. Birkaç dakika sonra sana `https://...vercel.app` adresi verir. Bu adres hem bilgisayarda hem telefonda açılır.
4. Telefonda adresi aç. iPhone: Paylaş > **Ana Ekrana Ekle**. Android: menü > **Uygulamayı yükle**.

İsteğe bağlı: CoinGecko'dan ücretsiz bir "demo" API anahtarı alıp Vercel'de **Settings > Environment Variables** bölümüne `COINGECKO_API_KEY` adıyla eklersen sınırlara takılma ihtimali azalır.

## Kendi bilgisayarında çalıştırma

Node.js 18 veya üstü gerekir.

```
node server.js
```

Sonra tarayıcıda http://localhost:3000 adresini aç.

## Dosyalar

- `src/app.html` uygulamanın tamamı (arayüz ve analiz motoru). Değiştirdikten sonra `python3 build.py` ile `public/` klasörü yeniden üretilir.
- `api/coins.js`, `api/news.js`, `api/exchanges.js`, `api/stocks.js`, `api/fx.js` (döviz kuru), `api/history.js` (karne için coin geçmişi), `api/push.js` ve `api/cron.js` (arka plan bildirimi), `api/translate.js` (haber çevirisi), `api/_engine.js` ve `api/_store.js`, `api/_push.js` (yardımcılar; `_engine.js` build.py ile üretilir) veri toplayan sunucu kısmı.
- `test/` analiz motoru ve sunucu testleri (`node test/engine.test.js`, `node test/api.test.js`, `node test/exchanges.test.js`, `node test/stocks.test.js`).

## Önemli

Hiçbir puan geleceği bilemez. Haber analizi basit bir kelime taramasıdır. Yalnızca kaybetmeyi göze alabileceğin parayla işlem yap. Bu yazılım yatırım tavsiyesi değildir.
