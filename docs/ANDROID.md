# Android — Kurulum ve Yapılandırma

> iOS tarafı için: [IOS_SETUP.md](IOS_SETUP.md).
> Bu belge Android'e özgü olanları anlatır; ortak mimari
> [ARCHITECTURE.md](ARCHITECTURE.md) içindedir.

## 1. Gereksinimler

| Araç | Sürüm |
|---|---|
| JDK | 17 |
| Android SDK | compileSdk 36, buildTools 36.0.0 |
| NDK | 27.1.12297006 |
| minSdk | 24 (Android 7.0) |

`android/local.properties` içinde `sdk.dir` tanımlı olmalı (git'e girmez).

## 2. Çalıştırma

```bash
npm install            # postinstall yamaları uygular (bkz. §6)
npm start              # Metro
npm run android        # cihaz/emülatör
```

Yalnızca APK üretmek için:

```bash
cd android
./gradlew :app:assembleDebug
```

## 3. Uygulama kimliği

| | Değer |
|---|---|
| `applicationId` (mağaza kimliği) | `com.aa.podcast` |
| `namespace` (Kotlin paketi) | `com.aacp` |

İkisi bilinçli olarak farklıdır: mağaza kimliği **iOS bundle kimliğiyle aynı**
tutulur (push ve derin bağlantı yapılandırması ikiye bölünmesin), kaynak ağacı
ise `com.aacp` altında kalır — paketi taşımak kazançsız bir değişiklik olurdu.

## 4. Gradle'a eklenen iki eklenti

`android/app/build.gradle` içinde iki `apply from` satırı vardır ve **ikisi de
zorunludur**:

| Satır | Olmadığında ne olur |
|---|---|
| `dotenv.gradle` (react-native-config) | `Config.APP_API_BASE_URL` tanımsız kalır → uygulama sunucusuz çalışır: katalog boş, senkron ve hesap sessizce kapalı |
| `fonts.gradle` (react-native-vector-icons) | Bütün ikonlar boş kutu çizilir |

iOS'ta bu işleri CocoaPods ve `Info.plist`'teki `UIAppFonts` yapar; Android'de
elle bağlanmaları gerekir.

Doğrulama:

```bash
# .env değerleri derlemeye girdi mi
grep APP_API_BASE_URL android/app/build/generated/**/BuildConfig.java
# fontlar APK'ya girdi mi
unzip -l android/app/build/outputs/apk/debug/app-debug.apk | grep fonts/
```

## 5. İzinler

Yayın derlemesinde sevk edilen izinler ve gerekçeleri:

| İzin | Neden |
|---|---|
| `INTERNET` | Ağ |
| `POST_NOTIFICATIONS` | Oynatma bildirimi (Android 13+) |
| `WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Arka planda oynatma |
| `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` | Çevrimdışı algılama (netinfo) |

`WAKE_LOCK` ve ön plan servisi izinleri ile `MusicService` bildirimini
react-native-track-player kendi manifestinde tanımlar; manifest birleştirme
onları taşır.

### Çıkarılan izinler

`react-native-blob-util` harici depolama izinleri bildiriyor ama biz
kullanmıyoruz: indirilen bölümler `DocumentDir`, kapak önbelleği `CacheDir`
altında — ikisi de uygulamaya özel alan. Bu yüzden manifest birleştirmede
`tools:node="remove"` ile çıkarılıyorlar:

```
WRITE_EXTERNAL_STORAGE
READ_EXTERNAL_STORAGE
DOWNLOAD_WITHOUT_NOTIFICATION
```

Sevk edilselerdi Google Play gerekçe ister, kullanıcı yükleme ekranında
"dosyalarınıza erişim" görürdü ve Android 10+ kapsamlı depolama nedeniyle
izin zaten işlevsiz olurdu.

> `SYSTEM_ALERT_WINDOW` yalnızca **hata ayıklama** derlemesinde görünür
> (React Native geliştirici menüsü). Yayın manifestinde yoktur.

### Çalışma zamanı izni

`POST_NOTIFICATIONS` manifestte bildirmekle yetmez; Android 13+ için çalışma
zamanında da sorulur. Bu, oynatıcı kurulurken yapılır
([TrackPlayerAudioService](../src/infrastructure/audio/TrackPlayerAudioService.ts)).
Reddedilirse **akış devam eder**: izin oynatmanın değil, kontrol yüzeyinin
koşuludur.

## 6. Kütüphane yaması (patch-package)

`react-native-track-player@4.1.2`, React Native 0.86 ile Kotlin düzeyinde
uyumsuzdur: `Arguments.fromBundle` artık non-null `Bundle` ister, kütüphane ise
nullable `originalItem` geçiriyor ve Android derlemesi **çöker**.

En son kararlı sürüm 4.1.2 olduğu için (5.0.0 yalnızca alpha) iki satırlık
düzeltme `patches/react-native-track-player+4.1.2.patch` içinde tutulur ve
`npm install` sonrası `postinstall` betiğiyle otomatik uygulanır.

Kütüphane yükseltilirken:

1. Yeni sürümde sorun düzelmişse yamayı **sil**,
2. Düzelmemişse yamayı yeniden üret:
   ```bash
   # node_modules içindeki dosyayı düzelt, sonra:
   npx patch-package react-native-track-player
   ```

> Alpha sürüme geçmek yerine yama seçildi: 5.0.0-alpha çalışan iOS/CarPlay
> entegrasyonunu riske atardı.

## 7. Kenardan kenara çizim (edge-to-edge)

`android/gradle.properties` içinde `edgeToEdgeEnabled=true`.

Bu bir tercih değil zorunluluktur: Android 15, hedefi API 35+ olan
uygulamalarda kenardan kenara çizimi zorunlu kıldı ve geçici devre dışı bırakma
bayrağı API 36'da kaldırıldı. `targetSdk 36` olduğumuz için kapalı bırakmak
sistem çubuklarının içeriği örtmesine yol açar.

Uygulama zaten her ekranda `useSafeAreaInsets` kullanıyor (`Screen`,
`HomeHeader`, şov/liste detayları, `GlobalDock`), dolayısıyla davranış doğru
olmalı — ama **cihazda görsel olarak doğrulanmalı**.

## 8. react-native-screens gereksinimi

`MainActivity.onCreate` içinde `super.onCreate(null)` çağrılır. Android,
Activity yeniden başlatıldığında View durumunu tutarlı geri yükleyemez ve bu,
ekran yığınında çökmeye yol açar; kaydedilmiş durum bilinçli olarak atılır ve
gezinme JavaScript tarafından yeniden kurulur.

## 9. Expo neden bağlanmıyor

`expo` paketi EAS Build için kuruludur (bkz. `eas.json`) ama uygulama **hiçbir
Expo modülü kullanmaz**. Otolinkleme paketin `android/` klasörünü görüp Gradle
projesine dahil etmeye çalışıyor ve derleme
`Plugin with id 'expo-module-gradle-plugin' not found` ile düşüyordu.

Çözüm: [`react-native.config.js`](../react-native.config.js) paketi yalnızca
**native bağlamadan** çıkarır. EAS tarafı (`eas.json`, `app.json`) etkilenmez.

İleride gerçekten bir Expo modülü gerekirse bu blok kaldırılır ve modül sistemi
usulünce kurulur.

## 10. Yayın imzası

Sürüm anahtarı **depoya girmez**. `~/.gradle/gradle.properties` (ya da CI gizli
değişkenleri) içine:

```properties
AACP_RELEASE_STORE_FILE=/mutlak/yol/aacp-release.keystore
AACP_RELEASE_STORE_PASSWORD=...
AACP_RELEASE_KEY_ALIAS=aacp
AACP_RELEASE_KEY_PASSWORD=...
```

Anahtar üretimi:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore aacp-release.keystore -alias aacp \
  -keyalg RSA -keysize 2048 -validity 10000
```

Bu değerler tanımlı değilse `release` derlemesi **hata ayıklama anahtarına
düşer**; yerel derleme çalışmaya devam eder ama Play Console debug imzalı
paketi reddeder — yani yanlışlıkla yayınlamak mümkün değildir.

```bash
cd android
./gradlew :app:bundleRelease     # Play Store için .aab
```

`.gitignore` `*.keystore` dosyalarını dışlar (`debug.keystore` istisna).

## 11. Henüz yapılmayanlar

| Konu | Durum |
|---|---|
| **Push bildirimi** | Sunucu yalnızca **APNs** konuşuyor. Android için FCM gerekir: Firebase projesi, `google-services.json`, istemci jeton kaydı ve worker'da bir `FcmSender`. `push_registrations` tablosu `platform` alanını zaten tutuyor. |
| **Android Auto** | CarPlay'in karşılığı. track-player destekliyor ama manifest ve `automotive_app_desc.xml` yapılandırması yapılmadı. CarPlay iş mantığı (`src/carplay`) yeniden kullanılamaz — Android Auto'nun kendi şablon sistemi var. |
| **Uyarlanabilir ikon** | Şu an yalnızca eski tip `ic_launcher` PNG'leri var. Android 8+ için `mipmap-anydpi-v26` uyarlanabilir ikon eklenmeli. |
| **Cihaz doğrulaması** | Derleme Windows'ta doğrulandı; **gerçek cihazda çalıştırılmadı**. Oynatma bildirimi, kenardan kenara yerleşim ve indirme akışı cihazda görülmeli. |
| **ProGuard** | `enableProguardInReleaseBuilds = false`. Yayına çıkmadan önce açılıp kural dosyası doğrulanmalı. |
