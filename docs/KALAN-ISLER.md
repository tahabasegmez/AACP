# Kalan İşler

Başlatılıp **tamamlanmamış** işler. Her madde "var olan" ve "eksik olan" olarak
ayrıştırıldı ki devam eden geliştirme sıfırdan başlamasın.

Son güncelleme: 2026-07-27

> Kaydırma jestleri (sağa=sıraya ekle, sola=listeye ekle) ve player'ı aşağı
> sürükleyip kapatma **tamamlandı** — bkz. `SwipeableRow`, `SwipeableEpisodeRow`.

---

## Kullanıcı hesabı sistemi — YAPILMADI (öncelikli)

İstenen: uygulamada kullanıcı mantığı; yerel kalması gerekenler (indirmeler)
dışındaki tüm kullanıcı verisi ileride sunucuda tutulabilmeli, tekrar eden
entity olmamalı.

**Var:** Sunucuda cihaz tabanlı anonim kimlik (`deviceId` → kalıcı kullanıcı +
HMAC jeton), `users` tablosu, senkron altyapısı (`SyncEngine` + koleksiyon
adaptörleri: progress, follows, saved).

**Eksik:**
- İstemcide bir **`User` domain entity'si ve `UserRepository` portu** yok.
  Bugün kullanıcı kavramı yalnızca sunucu tarafında var; uygulama anonim.
- **Playlist senkronu yok.** `PlaylistRepository` yereldir; senkron koleksiyonu
  (`playlists`) ne istemcide ne sunucuda tanımlı. Playlist entity'si bunu
  destekleyecek şekilde tasarlandı (`updatedAt` alanı mevcut).
- **Oturum/profil UI'ı yok** (giriş, çıkış, hesap ekranı).
- **Sunucu tarafı güncellemesi** (madde 12): playlist koleksiyonu için
  `sync_records` şeması hazır ama uç/adaptör eklenmeli.

Sıralama önerisi: önce `User` entity + `UserRepository` portu → sonra playlist
senkron adaptörü (istemci) → sonra sunucu ucu → en son giriş UI'ı.

## Push bildirimleri — yarım

**Var:** Jeton kayıt/silme uçları, `push_registrations` tablosu,
[FeedWatcher](../server/src/modules/push/FeedWatcher.ts) (yeni bölüm tarama +
takipçi eşleştirme, 6 test), `PushSender` portu + log adaptörü, zamanlayıcı.

**Eksik:**
- **APNs gönderici** — `.p8` anahtarı + Key ID + Team ID gerekir.
- **iOS istemci tarafı** — bildirim izni ve jetonu `/v1/push/register`'a
  gönderme. Xcode'da *Push Notifications* capability → **yalnızca mac'te.**

## Playlist kapağı seçimi — altyapı hazır, paket kurulu değil

`ImagePicker` portu ve [LibraryImagePicker](../src/infrastructure/image/LibraryImagePicker.ts)
adaptörü yazıldı. Paket kurulu olmadığından kapak seçimi UI'da otomatik olarak
pasif görünür (uygulama çalışır, kapaksız liste oluşturulur).

Etkinleştirmek için:
```bash
npm i react-native-image-picker && npx pod-install
```
iOS `Info.plist`'e `NSPhotoLibraryUsageDescription` eklenmelidir.

## AirPlay / "Cihaz" tuşu — yok

iOS'ta `AVRoutePickerView` native köprüsü gerekir. Windows'ta yazılıp
doğrulanamaz → **mac'te yapılmalı.**

## Telemetri paneli — yok

Olaylar `analytics_events` tablosuna yazılıyor, görselleştirme arayüzü yok.

## E2E test — yok

Birim testleri var (uygulama 160, backend 28). Uçtan uca akış testi (Detox veya
Maestro) yok.

## i18n — yok

Metinler Türkçe sabit.

## react-native-config kurulu değil

[env.ts](../src/core/config/env.ts) build-zamanı override'larını okumaya hazır
(`APP_API_BASE_URL`, `APP_EPISODE_SOURCE`, `APP_AD_TAG_URL`) ama paket kurulu
değil; ortam preset'leri koddan geliyor.

## Reklam — post-roll hazır, mid-roll yok

Bkz. [REKLAM.md](REKLAM.md) §5. `AdPlacement` üç değeri de tanıyor; mid-roll
için tetikleyici ve "reklam sonrası bölüm konumuna dönme" mantığı gerekir.

## Liquid Glass (iOS 26)

Hazırlık yapıldı, geçiş iOS 26 SDK'sı ile — bkz. [LIQUID_GLASS.md](LIQUID_GLASS.md).

---

## Öncelik notu

Sunucu ayağa kalkınca ilk iş:
1. `env.apiBaseUrl`'i doldur ([env.ts](../src/core/config/env.ts))
2. Kataloğu yayınla: `node scripts/generate-shows-json.js`

Bkz. [SUNUCU-KURULUM.md](SUNUCU-KURULUM.md).
