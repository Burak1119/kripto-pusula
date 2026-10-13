# Kripto Pusula

Kripto piyasasını ve seçilmiş BIST + ABD hisselerini tarayan, haberleri okuyan ve her biri için **Güçlü Al / Al / Bekle / Azalt / Sat** önerisi üreten bir karar destek uygulaması. Aynı kodla web sitesi olarak çalışır, telefonda ana ekrana eklenince uygulama gibi açılır.

Uygulama senin yerine işlem **yapmaz**. Sadece analiz eder ve gerekçesiyle öneri verir.

## Nasıl çalışır

- **Coin / Hisse seçimi:** Uygulama her açılışta "Coin mi Hisse mi?" diye sorar. İkisi birbirinden ayrıdır: kendi Pano, Piyasa, Haberler ve Rehber sekmeleri, kendi renk teması ve kendi haber kaynakları vardır. Üstteki düğmeyle istediğin an diğerine geçilir, sol üstteki isme basınca seçim ekranına dönülür.
- **Fiyat verisi:** CoinGecko (ilk 500 coin, 7 günlük fiyat grafiği, 1sa/24sa/7g/30g değişim, hacim).
- **Borsalar:** Binance (herkese açık piyasa verisi, anahtar gerekmez) ve Midas (getmidas.com/canli-kripto sayfasındaki herkese açık tablo). Midas'ın resmi bir API'si olmadığı için sayfa tasarımı değişirse Midas bölümü boş kalabilir, uygulamanın geri kalanı etkilenmez. Bir satıra basınca ilgili borsanın coin sayfası açılır.
- **Rehber sekmesi:** Her coin için ne olduğu, uzun analiz, riskler ve Midas/Binance canlı fiyatı. ABD ve BIST hisseleri için de aynısı: fiyatlar Midas'ın herkese açık sayfalarından, geçmiş fiyat (analiz için) Yahoo Finance'in herkese açık grafik verisinden gelir. Bu iki kaynak da resmi bir API değildir; çalışmazsa ilgili kısım boş kalır, uygulama çalışmaya devam eder.
- **Haberler:** Coin için CoinDesk, Cointelegraph (EN ve TR), Decrypt, The Block. Hisse için Yahoo Finance, CNBC, MarketWatch, Bloomberg HT, AA Ekonomi RSS yayınları; başlıklar şirket adı ve sembolüne göre hisselerle eşleştirilir.
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
- `api/coins.js`, `api/news.js`, `api/exchanges.js`, `api/stocks.js` veri toplayan sunucu kısmı.
- `test/` analiz motoru ve sunucu testleri (`node test/engine.test.js`, `node test/api.test.js`, `node test/exchanges.test.js`, `node test/stocks.test.js`).

## Önemli

Hiçbir puan geleceği bilemez. Haber analizi basit bir kelime taramasıdır. Yalnızca kaybetmeyi göze alabileceğin parayla işlem yap. Bu yazılım yatırım tavsiyesi değildir.
