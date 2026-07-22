# iOS Native Kurulum Checklist (mac aşaması)

Bu belge, macbook'a geçtiğinde iOS derlemesi için yapılması gereken **native**
adımları toplar. JS/mimari tarafı Windows'ta tamamlandı; burada yalnızca Xcode/
CocoaPods/entitlement işleri var. Sırayla ilerle.

> Not: Bu proje `AppRoot`/composition root ile hazır; ekranlar sonra yapılacak.
> Aşağıdakiler ses (track-player), CarPlay, kalıcı depolama (MMKV) ve remote-config
> içindir.

---

## 0. Ön koşullar
- [ ] Xcode (güncel) + Command Line Tools
- [ ] Ruby + CocoaPods (`sudo gem install cocoapods` veya `brew install cocoapods`)
- [ ] `npm install` (repo kökünde) — JS bağımlılıkları
- [ ] `cd ios && pod install` — native modüllerin pod'ları (track-player, mmkv,
      nitro-modules, carplay, screens, safe-area, gesture-handler)

## 1. react-native-track-player (arka plan ses)
- [ ] **Background Modes** capability ekle → **Audio, AirPlay and Picture in Picture**
      (Xcode → Target → Signing & Capabilities → + Capability → Background Modes).
      `Info.plist`'te `UIBackgroundModes` altında `audio` görünmeli.
- [ ] Playback service zaten kayıtlı: [index.js](../index.js) →
      `TrackPlayer.registerPlaybackService(...)` → [playbackService.ts](../src/infrastructure/audio/playbackService.ts).
- [ ] Kilit ekranı kontrolleri `TrackPlayerAudioService.setup()` içindeki
      `updateOptions` ile ayarlı (Play/Pause/Seek/Jump). Cihazda doğrula.

## 2. Apple CarPlay
CarPlay entitlement Apple'dan **özel izin** ister (Apple Developer hesabında
"CarPlay audio app" yetkisi başvurusu). Geliştirme sırasında Simulator'da CarPlay
ekranı ile test edilebilir.
- [ ] Apple'dan **CarPlay audio** entitlement'ı iste (com.apple.developer.carplay-audio).
- [ ] `ios/<App>/<App>.entitlements` dosyasına entitlement anahtarını ekle.
- [ ] **Scene delegate**: CarPlay ayrı bir scene kullanır. `Info.plist` →
      `UIApplicationSceneManifest` altında CarPlay scene (`CPTemplateApplicationSceneSessionRoleApplication`)
      için `RNCarPlaySceneDelegate` tanımla (react-native-carplay dokümanındaki adımlar).
- [ ] Bağlanınca kök şablon otomatik gelir: [registerCarPlay.ts](../src/app/carplay/registerCarPlay.ts)
      (yalnızca iOS'ta çağrılır) → [CarPlayController](../src/carplay/controllers/CarPlayController.ts).
- [ ] Xcode'da **CarPlay Simulator** (I/O → External Displays → CarPlay) ile şov→bölüm→
      now playing akışını doğrula.

## 3. react-native-mmkv (kalıcı depolama)
- [ ] `pod install` yeterli (nitro-modules ile). Ekstra config gerekmez.
- [ ] Cihazda "kaldığın yer" kalıcılığını doğrula (uygulamayı kapat-aç, konum korunur).
- [ ] (Opsiyonel) Hassas veri için MMKV encryption — [MmkvKeyValueStorage](../src/infrastructure/storage/MmkvKeyValueStorage.ts)
      `createMMKV({ id, encryptionKey })` ile genişletilebilir.

## 4. Remote-config (App Transport Security)
- [ ] `remoteCatalogUrl` **HTTPS** olmalı (ATS düz HTTP'yi engeller). Bkz.
      [REMOTE_CONFIG.md](./REMOTE_CONFIG.md). Ayrıca RSS/medya alan adları
      (`feeds.transistor.fm`, `media.transistor.fm`, `img.transistorcdn.com`) da
      HTTPS olduğu için ek ATS istisnası gerekmez.

## 5. Genel iOS
- [ ] Bundle Identifier + Team (Signing).
- [ ] Uygulama ikonları / launch screen (tasarım gelince).
- [ ] `Info.plist` → `NSAppTransportSecurity` yalnızca gerekiyorsa (varsayılan güvenli).

---

## Hızlı komutlar (mac)
```sh
npm install
cd ios && pod install && cd ..
npm run ios          # veya Xcode'dan çalıştır
```

## Doğrulama sırası
1. `npm test` + `npx tsc --noEmit` (Windows'ta da geçer) → JS/mantık sağlam.
2. `pod install` → native bağlanma.
3. Simulator'da uygulama açılışı (ekranlar sonra; şimdilik veri akışı/log).
4. Ses: bir bölüm çal → arka plan + kilit ekranı kontrolleri.
5. CarPlay Simulator: şov listesi → bölümler → now playing.
