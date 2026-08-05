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

### ⚠️ `build_config_package` kaynak dizesi

`dotenv.gradle` tek başına YETMEZ. react-native-config, değerleri okuyacağı
sınıfı `<applicationId>.BuildConfig` olarak arar. Bizde `applicationId`
(`com.aa.podcast`) ile `namespace` (`com.aacp`) bilinçli olarak farklı, sınıf
ise `namespace` altında üretiliyor — arama başarısız olur.

Belirti sinsidir: **uygulama açılır, çökmez**, yalnızca `.env` değerleri boş
gelir ve uygulama sessizce sunucusuz çalışır. Tek ipucu logdadır:

```
D ReactNative: ReactConfig: Could not find BuildConfig class
```

Bu yüzden `res/values/strings.xml` içinde kütüphanenin resmî kancası tanımlıdır:

```xml
<string name="build_config_package">com.aacp</string>
```

Değeri `namespace` ile aynı kalmalıdır.

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

## 6. track-player neden 5.0.0-alpha0

`react-native-track-player` **5.0.0-alpha0** sürümüne sabitlenmiştir (`^` yok —
alpha sürümlerin sessizce değişmesi istenmiyor).

Sebep: **4.x Android'de Yeni Mimari ile çalışamaz.** 4.1.2'de 36 `@ReactMethod`
fonksiyonu Kotlin ifade gövdesiyle yazılmış (`= scope.launch { ... }`) ve
dolayısıyla `Job` döndürüyor. TurboModule interop katmanı bunu reddediyor:

```
TurboModule system assumes returnType == void iff the method is synchronous
```

Uygulama derleniyor ama **açılışta çöküyordu**.

Denenen ve elenen yollar:

| Yol | Neden olmadı |
|---|---|
| Eski mimariye dönmek | RN 0.82'den beri `newArchEnabled=false` YOK SAYILIYOR; 0.86'da tek mimari Yeni Mimari |
| 4.1.2'yi yamalamak | 36 metodu blok gövdeye çevirmek gerekir — yukarı akışın terk ettiği bir sürümün çatalını bakmak demek |

5.x bu sorunu kökten çözüyor: modül artık codegen'le üretilen
`NativeTrackPlayerSpec`'i genişletiyor ve **hiç `@ReactMethod` içermiyor**, yani
hatayı fırlatan interop ayrıştırıcısı devreden çıkıyor. Ayrıca Media3
`MediaLibraryService` bildirimi geliyor — Android Auto'nun temeli.

**Göç yüzeyi tek satırdı:** `UpdateOptions.compactCapabilities` kaldırılmış;
yerine bildirim tuşları `notificationCapabilities` ile veriliyor
([TrackPlayerAudioService](../src/infrastructure/audio/TrackPlayerAudioService.ts)).

> **iOS'ta doğrulanmalı.** Yükseltme Android emülatöründe uçtan uca test edildi
> (oynatma, bildirim, ön plan servisi). iOS tarafı Windows'tan derlenemediği
> için CarPlay ve kilit ekranı davranışı mac'te sınanmalı. `pod install`
> gerekir.

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
| **Android Auto** | Temeli hazır: track-player 5 Media3 `MediaLibraryService` bildiriyor. Eksik olan `automotive_app_desc.xml` ve manifest meta verisi. CarPlay iş mantığı (`src/carplay`) yeniden kullanılamaz — Android Auto'nun kendi tarama (browse) ağacı var. |
| **Uyarlanabilir ikon** | Şu an yalnızca eski tip `ic_launcher` PNG'leri var. Android 8+ için `mipmap-anydpi-v26` uyarlanabilir ikon eklenmeli. |
| **Gerçek cihaz** | API 35 emülatöründe uçtan uca doğrulandı: uygulama açılıyor, katalog sunucudan geliyor, ses çalıyor, medya bildirimi ve ön plan servisi (`types=mediaPlayback`) ayakta. **Fiziksel cihazda** ve indirme/çevrimdışı akışında sınanmadı. |
| **ProGuard** | `enableProguardInReleaseBuilds = false`. Yayına çıkmadan önce açılıp kural dosyası doğrulanmalı. |
