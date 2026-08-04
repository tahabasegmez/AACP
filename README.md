# AACP — Anadolu Ajansı Podcast

Anadolu Ajansı podcast'leri için React Native uygulaması. Öncelik **iOS + Apple
CarPlay**. Podcast verisi Transistor RSS feed'lerinden gelir.

> **UI şu an geçicidir.** Ekranlar yalnızca veri akışını doğrulamak için en sade
> halde yazıldı; sonraki fazda Spotify'dan esinlenilmiş arayüzle değiştirilecek.

## Hızlı başlangıç

**macOS'ta (iOS derlemesi):** → **[docs/IOS_SETUP.md](docs/IOS_SETUP.md)** (adım adım rehber)

```sh
npm install                      # .npmrc legacy-peer-deps'i halleder
cd ios && pod install && cd ..   # yalnızca macOS
npm start                        # Metro
npm run ios                      # veya npm run android
```

Kalite kapısı (native gerekmez, Windows'ta da çalışır):
```sh
npm run ci     # typecheck + lint + test
```

## Dokümantasyon

| Belge | İçerik |
|-------|--------|
| [docs/IOS_SETUP.md](docs/IOS_SETUP.md) | **macOS'ta çalıştırma**: kurulum, imzalama, CarPlay, sorun giderme |
| [docs/ANDROID.md](docs/ANDROID.md) | **Android**: kurulum, izinler, imzalama, kütüphane yaması, eksikler |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Clean Architecture katmanları, bağımlılık kuralı, yeni özellik ekleme |
| [src/README.md](src/README.md) | Klasör haritası (hızlı bakış) |
| [docs/VERI-MIMARISI.md](docs/VERI-MIMARISI.md) | Hangi veri nerede yaşar (PostgreSQL / NoSQL), şov kataloğu otomasyonu |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) | Bağımlılıklar ve neden seçildikleri |

## Mimari özet

Clean Architecture — bağımlılıklar her zaman içe doğru akar; `domain` saf
TypeScript'tir (React/RN/kütüphane bağımlılığı yok), bu yüzden iş mantığı
platformdan bağımsız ve test edilebilirdir.

```
core → paylaşılan kernel      domain → iş kuralı (entities/ports/usecases)
data → repository impl        infrastructure → fetch, RSS, track-player, MMKV
presentation → RN UI          carplay → CarPlay yüzeyi (aynı use case'ler)
app → composition root (her şeyi bağlayan tek yer)
```

Ayrıntı için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Teknolojiler

React Native 0.86 · TypeScript · TanStack Query · Zustand · React Navigation ·
react-native-track-player · react-native-carplay · react-native-mmkv · fast-xml-parser
