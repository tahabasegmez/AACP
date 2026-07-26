# Kalan İşler

Başlatılıp **tamamlanmamış** işler. Her madde "var olan" ve "eksik olan" olarak
ayrıştırıldı ki devam eden geliştirme sıfırdan başlamasın.

Son güncelleme: 2026-07-26

---

## Push bildirimleri — yarım

**Var:**
- Jeton kayıt/silme uçları (`POST /v1/push/register`, `/unregister`)
- `push_registrations` tablosu, [PushService](../server/src/modules/push/PushService.ts)
- Yeni bölümleri saptayan tarayıcı ([FeedWatcher](../server/src/modules/push/FeedWatcher.ts))
- Gönderici portu + log adaptörü ([PushSender](../server/src/modules/push/PushSender.ts))

**Eksik:**
- **APNs gönderici** — `PushSender` portunu implement eden gerçek adaptör.
  Apple'dan `.p8` anahtarı + Key ID + Team ID gerekir; sertifika yönetimi.
- **iOS istemci tarafı** — bildirim izni isteme ve cihaz jetonunu
  `/v1/push/register`'a gönderme. Xcode'da *Push Notifications* capability
  eklenmeli → **yalnızca mac'te yapılabilir.**

## Hesap tabanlı kimlik — yok

**Var:** cihaz tabanlı anonim kimlik (deviceId → kalıcı kullanıcı + HMAC jeton).

**Eksik:** e-posta/SSO ile hesap. Bugün kullanıcı telefon değiştirince verisi
taşınmıyor. `users` tablosu bunu sonradan bağlayacak şekilde tasarlandı
(`device_id` nullable, hesap kaydı aynı satıra eklenebilir).

## AirPlay / "Cihaz" tuşu — yok

iOS'ta `AVRoutePickerView` native köprüsü gerekir. Windows'ta yazılıp
doğrulanamaz → **mac'te yapılmalı.** Player'daki "Cihaz" tuşu şu an bilgi
mesajı gösteriyor.

## Telemetri paneli — yok

Olaylar `analytics_events` tablosuna yazılıyor ama görselleştirme arayüzü yok.
SQL ile sorgulanabilir:

```sql
SELECT name, COUNT(*) FROM analytics_events
WHERE occurred_at > strftime('%s','now','-7 days') * 1000
GROUP BY name;
```

## E2E test — yok

Birim testleri var (uygulama + backend). Uçtan uca akış testi (Detox veya
Maestro) yok.

## i18n — yok

Metinler Türkçe sabit. Çoklu dil gerekirse `i18next` altyapısı kurulmalı;
metinler şu an bileşenlerin içinde.

## react-native-config kurulu değil

[env.ts](../src/core/config/env.ts) build-zamanı override'larını okumaya hazır
(`APP_API_BASE_URL`, `APP_EPISODE_SOURCE`, `APP_TRANSISTOR_API_KEY`) ama paket
kurulu değil; şu an ortam preset'leri koddan geliyor. Paket eklenince kod
değişmeden çalışır.

## Liquid Glass (iOS 26)

Hazırlık yapıldı, geçiş iOS 26 SDK'sı ile yapılacak — bkz. [LIQUID_GLASS.md](LIQUID_GLASS.md).

---

## Öncelik notu

Sunucu ayağa kalkınca ilk iş:
1. `env.apiBaseUrl`'i doldur ([env.ts](../src/core/config/env.ts))
2. Kataloğu yayınla: `node scripts/generate-shows-json.js`

Bkz. [SUNUCU-KURULUM.md](SUNUCU-KURULUM.md).
