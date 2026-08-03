# Kalan İşler

Başlatılıp **tamamlanmamış** işler. Her madde "var olan" ve "eksik olan" olarak
ayrıştırıldı ki devam eden geliştirme sıfırdan başlamasın.

Son güncelleme: 2026-07-27

---

## iOS'ta yapılması gerekenler (mac gerekir)

Kod tarafı hazır; yalnızca Xcode adımları kaldı.

### Push bildirimleri

**Var:** Sunucu tarafı uçtan uca hazır — jeton kayıt uçları,
[FeedWatcher](../worker/src/push/FeedWatcher.ts) (yeni bölüm tarama + takipçi
eşleştirme), [ApnsSender](../worker/src/push/ApnsSender.ts) (fetch + Web Crypto
ile doğrudan APNs; harici kütüphane yok), Cloudflare Cron Trigger.

**Eksik (mac):**
1. Xcode → Signing & Capabilities → **Push Notifications** ekle.
2. Apple Developer'dan `.p8` anahtarı indir ve Worker gizli değerlerine ekle:
   `wrangler secret put APNS_KEY` (+ `APNS_KEY_ID`, `APNS_TEAM_ID`).
3. **İstemci tarafı**: bildirim izni isteme ve cihaz jetonunu
   `POST /v1/push/register`'a gönderme — henüz yazılmadı.

### AirPlay

**Var:** [RoutePicker](../src/core/ports/RoutePicker.ts) portu,
[NativeRoutePicker](../src/infrastructure/audio/NativeRoutePicker.ts) adaptörü ve
native modül ([AirPlayRoutePicker.swift](../ios/AACP/AirPlayRoutePicker.swift) +
`.m` köprüsü). Player'daki "Cihaz" düğmesi bağlı.

**Durum:** Tamamlandı — `AirPlayRoutePicker.swift` ve `.m` köprüsü
`project.pbxproj` içinde derleme kaynaklarına eklendi. Modül bulunamazsa düğme
kendiliğinden pasifleşir; uygulama çalışmaya devam eder.

### Kurulum sonrası

`npm install` yapıldı (`react-native-image-picker`, `react-native-config`).
Mac'te ek olarak:

```bash
npx pod-install
```

`Info.plist`'e eklenmeli:
- `NSPhotoLibraryUsageDescription` (playlist kapağı seçimi)

## Şifre sıfırlama / SSO — yok

Hesap sistemi e-posta + şifre ile çalışıyor. Şifre sıfırlama e-posta gönderimi
(SMTP/servis) gerektirir; Apple/Google ile giriş ayrı bir entegrasyondur.
Bkz. [KULLANICI-VE-HESAP.md](KULLANICI-VE-HESAP.md) §8.

## Telemetri paneli — yok

Olaylar `analytics_events` tablosuna yazılıyor, görselleştirme arayüzü yok.
SQL ile sorgulanabilir:

```sql
SELECT name, COUNT(*) FROM analytics_events
WHERE occurred_at > strftime('%s','now','-7 days') * 1000
GROUP BY name;
```

## E2E test — yok

Birim testleri var (uygulama 175, backend 42). Uçtan uca akış testi (Detox veya
Maestro) yok.

## i18n — yok

Metinler Türkçe sabit. Çoklu dil gerekirse `i18next` altyapısı kurulmalı.

## Reklam — post-roll hazır, mid-roll yok

Bkz. [REKLAM.md](REKLAM.md) §5. `AdPlacement` üç değeri de tanıyor; mid-roll
için tetikleyici ve "reklam sonrası bölüm konumuna dönme" mantığı gerekir.

## Liquid Glass (iOS 26)

Hazırlık yapıldı, geçiş iOS 26 SDK'sı ile — bkz. [LIQUID_GLASS.md](LIQUID_GLASS.md).

---

## Sunucu ayağa kalkınca

1. `.env` oluştur (kök dizin): `cp .env.example .env` → `APP_API_BASE_URL` doldur
2. Kataloğu doldur: `cd worker && npm run catalog:import` (bkz. [VERI-MIMARISI.md](VERI-MIMARISI.md) §4.1)

Bkz. [CLOUDFLARE-SUPABASE-KURULUM.md](CLOUDFLARE-SUPABASE-KURULUM.md).
