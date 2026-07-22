# src/ — Katman Haritası

Bu proje **Clean Architecture** kullanır. Ayrıntılı anlatım: [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)

Bağımlılık yönü her zaman **içe doğru**. `domain` hiçbir şeye bağımlı değildir.

```
src/
├── core/            Paylaşılan kernel — config, error/Result, logger, DI, ports, utils
│                    (iş kuralı yok, hiçbir katmana bağımlı değil)
│
├── domain/          İŞ KURALI (kalp) — saf TypeScript, platform bağımsız
│   ├── entities/    Show, Episode, PodcastFeed, PlaybackState, Download
│   ├── repositories/  Veri erişim PORT'ları (arayüz)
│   ├── services/    AudioPlayerService PORT'u
│   └── usecases/    GetShowCatalog, GetPodcastFeed, PlayEpisode ...
│
├── data/            domain portlarının implementasyonu
│   ├── dto/         RSS ham veri şekilleri
│   ├── mappers/     DTO → domain entity dönüşümü
│   ├── datasources/ remote (RSS/HTTP) + local (cache)
│   └── repositories/  Repository implementasyonları
│
├── infrastructure/  Somut teknoloji adaptörleri
│   ├── network/     FetchHttpClient  (HttpClient portu)
│   ├── rss/         FastXmlParser    (XmlParser portu)
│   ├── audio/       TrackPlayerAudioService (AudioPlayerService portu)
│   └── storage/     KeyValueStorage
│
├── presentation/    React Native mobil UI (iOS öncelikli)
│   ├── di/          DependencyProvider + useDependencies
│   ├── theme/       Tema token'ları + ThemeProvider
│   ├── query/       TanStack Query hook'ları (use case'leri sarar)
│   ├── stores/      Zustand (playerStore)
│   ├── navigation/  React Navigation
│   └── features/    shows/, player/ ... (her feature kendi screens/components)
│
├── carplay/         Apple CarPlay yüzeyi — aynı use case'leri kullanır
│   ├── controllers/ CarPlayController (şablon yaşam döngüsü)
│   └── ...          templates (sonraki faz)
│
└── app/             COMPOSITION ROOT — her şeyi bağlayan tek yer
    ├── di/          composeDependencies (tüm `new XyzImpl()` burada)
    └── AppRoot.tsx  Sağlayıcılar + navigasyon
```

## Import kuralı (path alias)
`@core`, `@domain`, `@data`, `@infrastructure`, `@presentation`, `@carplay`, `@app`
takma adları `tsconfig.json` + `babel.config.js`'de tanımlı. Örnek:

```ts
import { Show } from '@domain/entities';
import { useShowsQuery } from '@presentation';
```

> **Altın kural:** `presentation` ve `carplay`, `data`/`infrastructure`'ı ASLA
> doğrudan import etmez. Yalnızca `@domain` use case'lerini kullanır; somut
> nesneler `app/di` üzerinden enjekte edilir.
