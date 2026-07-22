# Bağımlılıklar ve Kurulum

## Durum
- ✅ **Kuruldu (Windows'ta çalışır):** `@tanstack/react-query`, `zustand`,
  `fast-xml-parser`, `@react-navigation/native`, `@react-navigation/native-stack`,
  `react-native-screens`, `react-native-gesture-handler`,
  `babel-plugin-module-resolver` (dev). RSS parser aktive edildi ve gerçek AA
  feed'iyle doğrulandı.
- ⏳ **Mac aşamasına bırakıldı (native link):** `react-native-track-player`,
  `react-native-carplay` (ses + CarPlay), `react-native-mmkv`,
  `react-native-blob-util` (kalıcı depolama + offline indirme). Kod içi import'ları
  yorum satırında; kurulunca aktive edilecek.

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

## 4. Depolama & Offline (native — sonraki faz)

| Paket | Amaç |
|-------|------|
| `react-native-mmkv` | Hızlı kalıcı key-value depolama |
| `react-native-blob-util` | Bölüm indirme / dosya yönetimi (offline) |

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

4. **Offline (sonraki faz)**:
   ```sh
   npm install react-native-mmkv react-native-blob-util
   ```

> Not: Native paketler Windows'ta `npm install` ile eklenebilir ama iOS derlemesi
> (pod install) yalnızca mac'te yapılır. Bu yüzden 3. ve 4. adımı mac aşamasına
> bırakmak en güvenlisi.
