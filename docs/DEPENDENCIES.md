# Bağımlılıklar ve Kurulum

## Durum
- ✅ **Kuruldu (Windows'ta çalışır):** `@tanstack/react-query`, `zustand`,
  `fast-xml-parser`, `@react-navigation/native`, `@react-navigation/native-stack`,
  `react-native-screens`, `react-native-gesture-handler`,
  `babel-plugin-module-resolver` (dev). RSS parser aktive edildi ve gerçek AA
  feed'iyle doğrulandı.
- ✅ **Kuruldu, native derleme mac'te:** `react-native-mmkv` (+ peer
  `react-native-nitro-modules`) — kalıcı depolama. JS/adaptör tarafı yazıldı ve
  test edildi; jest'te `__mocks__/react-native-mmkv.js` ile taklit edilir. Cihazda
  (iOS/Android) MMKV yoksa `createPersistentStorage` bellek-içi'ne güvenle düşer.
  iOS derlemesi için: `cd ios && pod install` (mac). MMKV **hem iOS hem Android**'de
  çalışır → Android'e geçince değişiklik gerekmez.
- ⏳ **Mac aşamasına bırakıldı (native link):** `react-native-track-player`,
  `react-native-carplay` (ses + CarPlay), `react-native-blob-util` (offline indirme).
  Kod içi import'ları yorum satırında; kurulunca aktive edilecek.

- ✅ **Offline & etkileşim (kuruldu, mac'te `pod install`):** `react-native-blob-util`
  (indirme — [BlobUtilDownloader](../src/infrastructure/download/BlobUtilDownloader.ts) soyutlaması),
  `@react-native-community/netinfo` (çevrimdışı algılama).
  - **Not:** Bölüm/not panelleri için `@gorhom/bottom-sheet` + `react-native-reanimated`
    kullanılmıyor. RN 0.86 + reanimated v4/worklets native uyum sorunları çıkardığı
    için, ağır bağımlılık yerine **saf React Native** ([ui/BottomSheet](../src/presentation/ui/BottomSheet.tsx),
    Modal + Animated + PanResponder) tercih edildi. Daha az native bağımlılık = daha
    az build riski.
- ✅ **UI (Stage 1 — kuruldu, mac'te `pod install`):** `@shopify/flash-list`
  (uzun listeler), `react-native-fast-image` (kapak cache; New-Arch riski için
  [CoverImage](../src/presentation/ui/CoverImage.tsx) soyutlaması), `react-native-vector-icons`
  (Ionicons; Info.plist'e kayıtlı), `react-native-linear-gradient` (degradeler),
  `@react-navigation/bottom-tabs` (alt sekmeler).

Aşağıdaki tablolar tüm bağımlılıkları ve kurulum sırasını gösterir.

## 1. Saf JS paketleri (Windows'ta kurulabilir, native link gerekmez)

| Paket | Amaç | Nerede kullanılır |
|-------|------|-------------------|
| `@tanstack/react-query` | Server state / cache | `presentation/query` |
| `zustand` | UI & player state | `presentation/stores` |
| `fast-xml-parser` | RSS/XML parse | `infrastructure/rss` |

## 2. Navigasyon (native ekran modülleri içerir → mac'te pod gerekir)

| Paket | Amaç |
|-------|------|
| `@react-navigation/native` | Navigasyon çekirdeği |
| `@react-navigation/native-stack` | Native stack navigator |
| `react-native-screens` | Native ekran optimizasyonu (peer) |
| `react-native-gesture-handler` | Jest hareketleri (peer) |

## 3. Ses & CarPlay (native — iOS tarafı mac'te yapılandırılır)

| Paket | Amaç |
|-------|------|
| `react-native-track-player` | Arka plan oynatma, lock screen, CarPlay kontrolü |
| `react-native-carplay` | CarPlay şablonları |

## 4. Depolama & Offline

| Paket | Amaç | Durum |
|-------|------|-------|
| `react-native-mmkv` (+ `react-native-nitro-modules`) | Hızlı kalıcı key-value depolama (iOS+Android) | ✅ kuruldu, mac'te `pod install` |
| `react-native-blob-util` | Bölüm indirme / dosya yönetimi (offline) | ⏳ sonraki faz |

## 5. Dev bağımlılıkları

| Paket | Amaç |
|-------|------|
| `babel-plugin-module-resolver` | `@core`, `@domain` … path alias'ları (babel) |

---

## Kurulum sırası (önerilen)

1. **Path alias + JS state paketleri** (Windows'ta hemen çalışır):
   ```sh
   npm install @tanstack/react-query zustand fast-xml-parser
   npm install -D babel-plugin-module-resolver
   ```
   Ardından `infrastructure/rss/FastXmlParser.ts` içindeki import'u aktive et.

2. **Navigasyon**:
   ```sh
   npm install @react-navigation/native @react-navigation/native-stack \
     react-native-screens react-native-gesture-handler
   ```

3. **Ses + CarPlay** (mac aşamasında, iOS native yapılandırmasıyla):
   ```sh
   npm install react-native-track-player react-native-carplay
   ```
   - `TrackPlayerAudioService.ts` metodlarını doldur, playback service kaydet.
   - iOS: background audio capability + CarPlay entitlement + scene delegate.

4. **Kalıcı depolama** (kuruldu; mac'te native derleme):
   ```sh
   # zaten kurulu: react-native-mmkv + react-native-nitro-modules
   cd ios && pod install   # mac
   ```
   Offline indirme (sonraki faz):
   ```sh
   npm install react-native-blob-util
   ```

> Not: Native paketler Windows'ta `npm install` ile eklenebilir ama iOS derlemesi
> (pod install) yalnızca mac'te yapılır. Bu yüzden 3. ve 4. adımı mac aşamasına
> bırakmak en güvenlisi.
