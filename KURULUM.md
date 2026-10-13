# Uygulama kapalıyken bildirim gelmesi için kurulum

Bu adımları yapmasan da uygulama çalışır; yalnızca bildirimler **uygulama açıkken** gelir.
Uygulama kapalıyken (telefon cebindeyken) de bildirim gelsin istiyorsan aşağıdaki 5 adımı bir kez yapman yeterli. Hepsi ücretsizdir.

Bildirim şunlar için gelir: elindeki bir varlığın sinyali Azalt/Sat'a dönerse, bir günde %8'den fazla oynarsa, kurduğun fiyat alarmına ulaşırsa.

## Nasıl çalışır?
Telefonun bildirimi bir sunucudan alması gerekir. Sunucu tarafı senin Vercel hesabında çalışır: dış bir "zamanlayıcı" 10 dakikada bir
`/api/cron` adresini ziyaret eder, o da fiyatlara ve sinyallere bakıp gerekiyorsa telefonuna bildirim yollar.
Sunucuya portföyünün **miktarları ve maliyetleri gönderilmez**; yalnızca izlediğin varlıkların adı ve fiyat alarmların saklanır.

## 1) Dosyaları GitHub'a yükle
Yeni zip içindeki dosyaları her zamanki gibi GitHub'a yükle (Add file > Upload files > Commit changes).
Vercel kendiliğinden yenilenir.

## 2) Vercel'de ücretsiz depo (Redis) ekle
1. vercel.com'da projeni aç.
2. Üstteki **Storage** sekmesine gir.
3. **Create Database** (ya da Marketplace'ten **Upstash**) > **Redis** seç, ücretsiz planı (Free) seç, adı serbest, **Create**.
4. Projeye bağla (**Connect Project** / "Connect to project"). Böylece `KV_REST_API_URL` ve `KV_REST_API_TOKEN` değişkenleri kendiliğinden eklenir.

(Vercel menü adlarını arada değiştirir; "Storage > Upstash Redis > ücretsiz > projeye bağla" mantığını izle.)

## 3) Üç gizli değeri ekle
Vercel'de projen > **Settings** > **Environment Variables**. Aşağıdaki üçünü tek tek ekle (Name = değişken adı, Value = sana ayrıca verilen değer), her seferinde **Save**:

| Name | Value |
|---|---|
| `VAPID_PUBLIC` | sana verilen uzun anahtar (herkese açık olan) |
| `VAPID_PRIVATE` | sana verilen kısa anahtar (gizli olan) |
| `CRON_KEY` | sana verilen rastgele şifre |

Bu değerleri GitHub'a **yükleme**, kimseyle paylaşma.

## 4) Yeniden yayınla
Vercel'de **Deployments** sekmesi > en üstteki yayının sağındaki **⋯** > **Redeploy**.

Kontrol: tarayıcıda `https://SİTENİN-ADRESİ/api/push?a=status` aç. `"ready":true` yazıyorsa sunucu hazır.

## 5) Zamanlayıcı kur (cron-job.org)
1. cron-job.org'a gir, ücretsiz hesap aç (e-posta onayı gerekir).
2. **Create cronjob** de.
3. **URL:** `https://SİTENİN-ADRESİ/api/cron?key=CRON_KEY_DEĞERİN`
4. **Execution schedule:** her 10 dakikada bir (Every 10 minutes).
5. Kaydet.

Kontrol: aynı adresi tarayıcıda açarsan `{"ok":true,...}` benzeri bir yanıt görürsün. `Anahtar yanlış` yazıyorsa `CRON_KEY` ile adresteki değer aynı değildir.

## Telefonda
- **iPhone:** siteyi Safari'de aç > Paylaş > **Ana Ekrana Ekle**. Sonra **ana ekrandaki ikondan** aç (iPhone'da bildirim yalnızca böyle çalışır; iOS 16.4 ya da üstü gerekir).
- **Android:** Chrome menüsü > **Uygulamayı yükle**, ya da doğrudan Chrome'dan aç.
- Uygulamada **Portföy** sekmesinde **Bildirimleri aç** > izin ver > **Deneme bildirimi gönder**. Birkaç saniye içinde telefona düşmeli.

## Sınırlar
- Kontrol yaklaşık 10-15 dakikada bir yapılır; anlık değildir.
- Bildirim vermediği zaman: telefonun "Rahatsız Etme" modu, pil tasarrufu ya da bildirim izni kapalı olabilir.
- Ücretsiz zamanlayıcı ve depo kullanıldığı için çok sayıda kullanıcıya açılacak bir servis değildir; kişisel kullanım içindir.
