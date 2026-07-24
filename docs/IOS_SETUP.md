# macOS'ta Çalıştırma Rehberi (iOS)

Proje Windows'ta geliştirildi; bu belge **mac'te fork/clone edip ilk kez
çalıştırmak** için gereken her şeyi sırayla anlatır. JS/mimari tarafı tamamlandı
ve testli — burada yalnızca native (Xcode/CocoaPods) adımları var.

> **Şu anki UI geçicidir.** Ekranlar (şov listesi / bölümler / oynatıcı) yalnızca
> veri akışını doğrulamak için en sade halde yazıldı. Sonraki fazda Spotify'dan
> esinlenilmiş arayüzle değiştirilecek.

---

## 0. Repoda ZATEN yapılandırılmış olanlar

Bunlar için mac'te ekstra iş yok:

| Konu | Durum |
|------|-------|
| Arka plan sesi | ✅ `UIBackgroundModes: audio` → [Info.plist](../ios/AACP/Info.plist) |
| track-player playback service | ✅ [index.js](../index.js)'te kayıtlı → [playbackService.ts](../src/infrastructure/audio/playbackService.ts) |
| Kilit ekranı kontrolleri | ✅ `updateOptions` ile ayarlı ([TrackPlayerAudioService](../src/infrastructure/audio/TrackPlayerAudioService.ts)) |
| Kalıcı depolama (MMKV) | ✅ kod hazır; sadece `pod install` gerekir |
| Uygulama içi ikonlar (vector-icons) | ✅ `Info.plist` UIAppFonts + pod fontları bundle'lar |
| npm peer çakışması | ✅ [.npmrc](../.npmrc) (`legacy-peer-deps=true`) — ekstra bayrak gerekmez |
| CarPlay kodu | ✅ hazır ([CarPlayController](../src/carplay/controllers/CarPlayController.ts)); **entitlement bekliyor** (bkz. §5) |
| ATS / HTTPS | ✅ tüm kaynaklar (feeds/media/img.transistorcdn) HTTPS — istisna gerekmiyor |

---

## 1. Ön koşullar

- [ ] **Node 22+** (`node -v`) — `package.json` `engines` ile uyumlu
- [ ] **Xcode** (güncel) + Command Line Tools
      (`xcode-select --install`, Xcode → Settings → Locations → Command Line Tools seçili)
- [ ] **iOS 16+** deployment target — NitroModules'ın Swift/C++ köprüsü için gerekli
- [ ] **CocoaPods** — `brew install cocoapods` (veya `sudo gem install cocoapods`)
- [ ] **Watchman** (opsiyonel ama önerilir) — `brew install watchman`
- [ ] **ccache** (Intel Mac için önerilir) — `brew install ccache`; ilk native
      derlemeyi değil, sonraki derlemeleri hızlandırır

## 2. Projeyi kur

```sh
git clone https://github.com/tahabasegmez/AACP.git
cd AACP

npm install          # .npmrc sayesinde legacy-peer-deps otomatik
cd ios && pod install && cd ..
```

`pod install` şu native modülleri bağlar: track-player, mmkv (+ nitro-modules),
carplay, screens, safe-area-context, gesture-handler.

Kurulumu doğrula (native olmadan da çalışır):
```sh
npm run ci     # typecheck + lint + test  → hepsi geçmeli
```

## 3. Xcode imzalama (ilk çalıştırma öncesi tek seferlik)

```sh
open ios/AACP.xcworkspace     # .xcodeproj DEĞİL, .xcworkspace
```

- [ ] Target **AACP** → **Signing & Capabilities**
- [ ] **Team**: kendi Apple Developer hesabın/şirket hesabı
- [ ] **Bundle Identifier**: benzersiz yap (ör. `com.aa.podcast.dev`)
- [ ] Simulator için imzalama gerekmez; **gerçek cihaz** için gerekir

## 4. Çalıştır

```sh
npm start          # Metro (ayrı terminalde bırak)
npm run ios        # veya Xcode'dan ▶︎
```

Xcode şeması Metro kapalıysa otomatik başlatır. Intel Mac'lerde ilk native
derleme uzun sürebilir; `ccache` ancak ilk derlemede önbellek dolduktan sonra
fayda sağlar. Hızlı tekrar derlemeler için gerekmedikçe **Clean Build Folder**
veya DerivedData temizliği yapma.

### Ne görmelisin
1. **Şov listesi** — 11 AA şovu **anında** gelir (ağ isteği yok; bundled katalog).
2. Bir şova dokun → **bölüm listesi**. İlk açılışta RSS indirilir
   (bazı şovlarda feed büyüktür, birkaç saniye sürebilir); liste sayfalı gelir.
3. Bir bölüme dokun → **çalmaya başlar** ve oynatıcı ekranı açılır.
4. Uygulamayı arka plana al → **ses devam etmeli**; kilit ekranında oynat/duraklat
   ve ±30/15 sn kontrolleri görünmeli.
5. Uygulamayı kapat-aç → aynı bölümde **kaldığın yerden devam** etmeli (MMKV).

---

## 5. CarPlay (Apple onayı sonrası)

CarPlay **özel entitlement** ister; onay gelmeden aşağıdakileri yapma (imzalama
hata verir). Uygulama CarPlay olmadan sorunsuz çalışır — kayıt başarısız olursa
[index.js](../index.js) hatayı yutup sadece uyarı loglar.

1. [ ] Apple Developer → **CarPlay audio app** yetkisi başvurusu yap.
2. [ ] Onay gelince Xcode → Target → **Build Settings** → *Code Signing Entitlements*
       = `AACP/AACP.entitlements` (dosya repoda hazır: [AACP.entitlements](../ios/AACP/AACP.entitlements)).
3. [ ] `Info.plist`'e CarPlay **scene manifest**'ini ekle (react-native-carplay
       dokümanındaki `UIApplicationSceneManifest` → `CPTemplateApplicationSceneSessionRoleApplication`
       ve `RNCarPlaySceneDelegate`).
4. [ ] Test: Simulator → **I/O → External Displays → CarPlay**.
       Beklenen akış: **Podcastler** listesi → şov → bölümler → seçince
       "kaldığın yerden" çalar + Now Playing şablonu.

> CarPlay ve telefon **aynı oynatıcı örneğini** paylaşır
> ([getDependencies](../src/app/di/getDependencies.ts) singleton'ı sayesinde),
> yani ikisinde de durum senkron ilerler.

---

## 6. Sorun giderme

**`pod install` hataları**
```sh
cd ios && pod repo update && pod install
# İnatçı durumlarda:
rm -rf Pods Podfile.lock && pod install
```

**"unable to open base configuration file" (BVLinearGradient, RNFastImage,
SDWebImage, libwebp, RNVectorIcons/Ionicons ...)**
Yeni native paket eklendi ama `pod install` çalıştırılmadı → o pod'ların
`.xcconfig` (base configuration) dosyaları oluşmamış. Çözüm:
```sh
cd ios && pod install       # olmazsa: rm -rf Pods Podfile.lock && pod install --repo-update
```
Sonra **`AACP.xcworkspace`** ile aç (`.xcodeproj` DEĞİL) ve Product → Clean Build
Folder yap. **Kural:** `git pull` sonrası bağımlılık değiştiyse `pod install`
tekrarlanmalı (`npm install` native tarafı bağlamaz).

**Metro / cache tuhaflıkları**
```sh
npm start -- --reset-cache
rm -rf node_modules && npm install
```

**Build hatası: react-native-carplay (New Architecture)**
RN 0.86 varsayılan olarak New Architecture kullanır; `react-native-carplay@2.3.0`
eski bir sürümdür ve interop katmanına güvenir. Derleme burada takılırsa geçici
çözüm sırası:
1. `index.js`'teki CarPlay bloğu zaten try/catch'te — **runtime** sorun çıkarmaz.
2. Derleme (compile) hatası verirse geçici olarak paketi çıkar:
   `npm uninstall react-native-carplay && cd ios && pod install`
   (CarPlay kodu repoda kalır; entitlement onayıyla birlikte güncel sürümle geri eklenir.)

**MMKV çalışmıyor / veriler kalıcı değil**
`createPersistentStorage` MMKV başlatılamazsa bellek-içi depolamaya düşer ve
konsola uyarı yazar. `pod install` yapıldığından ve `react-native-nitro-modules`
kurulu olduğundan emin ol.

**İkonlar kutu/görünmüyor**
`pod install` fontları bundle'lar, `Info.plist` UIAppFonts kaydeder (Ionicons).
Görünmezse Xcode'da temiz derleme (Product → Clean Build Folder) dene.

**react-native-fast-image (New Architecture) derleme sorunu**
RN 0.86 New Arch kullanır; `react-native-fast-image` bakımı durgundur. Derleme
burada takılırsa görsel bileşeni tek dosyada soyutlandı ([CoverImage](../src/presentation/ui/CoverImage.tsx)) —
sadece o dosyanın içini `expo-image` veya `@d11/react-native-fast-image` ile
değiştirmek yeterli (API'si benzer, ekranlar değişmez).

**Ses arka planda kesiliyor**
Xcode → Signing & Capabilities → **Background Modes → Audio** işaretli mi kontrol et
(Info.plist'te tanımlı ama capability olarak da görünmeli).

---

## 7. Hızlı doğrulama listesi

- [ ] `npm run ci` geçiyor
- [ ] `pod install` sorunsuz
- [ ] Simulator'da uygulama açılıyor, 11 şov listeleniyor
- [ ] Bölüm çalıyor, arka planda devam ediyor, kilit ekranı kontrolleri çalışıyor
- [ ] Kapat-aç → kaldığın yerden devam
- [ ] (Entitlement sonrası) CarPlay Simulator akışı
