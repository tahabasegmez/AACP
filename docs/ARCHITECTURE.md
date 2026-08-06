# AACP — Mimari Rehberi

> Anadolu Ajansı Podcast uygulaması. React Native (öncelik: iOS + Apple CarPlay).
> Podcast verisi Transistor üzerindeki RSS feed'lerinden çekilir.

Bu belge projenin **Clean Architecture** kurgusunu, katmanlar arası bağımlılık
kuralını ve her klasörün ne işe yaradığını anlatır. Amaç: proje büyüdükçe yeni
özellik eklerken nereye ne yazacağını tereddütsüz bilmek.

---

## 1. Temel Kural: Bağımlılık Yönü

Bağımlılıklar **her zaman içe doğru** akar. İçteki katman dıştakini **bilmez**.

```
        ┌─────────────────────────────────────────────┐
        │                presentation                  │  (React Native UI)
        │                  carplay                     │  (CarPlay UI)
        └───────────────────┬─────────────────────────┘
                            │ kullanır
        ┌───────────────────▼─────────────────────────┐
        │                   domain                     │  ← MERKEZ (saf iş kuralı)
        │        entities · ports · usecases           │
        └───────────────────▲─────────────────────────┘
                            │ implemente eder
        ┌───────────────────┴─────────────────────────┐
        │              data · infrastructure           │  (RSS, HTTP, track-player)
        └──────────────────────────────────────────────┘

                 app  →  hepsini birbirine bağlar (composition root)
                 core →  tüm katmanların paylaştığı çekirdek (bağımlılıksız)
```

**Altın kural:** `domain` hiçbir şeye bağımlı değildir. React yok, react-native
yok, axios yok, track-player yok. Sadece saf TypeScript. Bu sayede iş mantığı
platformdan (iOS/Android) tamamen bağımsızdır ve test edilebilir.

Bağımlılık matrisi (satır → sütuna bağımlı olabilir mi?):

| Katman           | core | domain | data | infrastructure | presentation | carplay | app |
|------------------|:----:|:------:|:----:|:--------------:|:------------:|:-------:|:---:|
| **core**         |  —   |   ✗    |  ✗   |       ✗        |      ✗       |    ✗    |  ✗  |
| **domain**       |  ✓   |   —    |  ✗   |       ✗        |      ✗       |    ✗    |  ✗  |
| **data**         |  ✓   |   ✓    |  —   |       ✗*       |      ✗       |    ✗    |  ✗  |
| **infrastructure**| ✓   |   ✓    |  ✗   |       —        |      ✗       |    ✗    |  ✗  |
| **presentation** |  ✓   |   ✓    |  ✗   |       ✗        |      —       |    ✗    |  ✗  |
| **carplay**      |  ✓   |   ✓    |  ✗   |       ✗        |      ✗       |    —    |  ✗  |
| **app**          |  ✓   |   ✓    |  ✓   |       ✓        |      ✓       |    ✓    |  — |

`✗* `: data, teknik ayrıntı için infrastructure yerine kendi `datasources`'unu
kullanır; somut teknoloji bağımlılıkları `app` içinde enjekte edilir.

Presentation ve carplay, `data`/`infrastructure`'ı **doğrudan import etmez**;
sadece `domain` arayüzlerini (use case / port) kullanır. Somut sınıflar
`app/di` üzerinden enjekte edilir. Böylece UI, verinin RSS'ten mi cache'ten mi
geldiğini bilmez.

---

## 2. Katmanlar

### `src/core` — Çekirdek (Shared Kernel)
Her katmanın ihtiyaç duyduğu, iş kuralı içermeyen yardımcılar. Hiçbir katmana
bağımlı değildir.
- `config/` — uygulama ayarları ve **curated feed kataloğu** (şov RSS listesi).
- `error/` — `AppError` tipleri ve `Result<T>` (hata yönetimi için).
- `logger/` — `Logger` arayüzü + varsayılan konsol implementasyonu.
- `utils/` — saf yardımcı fonksiyonlar (tarih, süre formatı vb.).

### `src/domain` — İş Kuralı (kalp)
Uygulamanın "ne yaptığı". Saf TypeScript. Platform ve kütüphane bağımsız.
- `entities/` — iş nesneleri: `Show`, `Episode`, `PodcastFeed`, `PlaybackState`…
- `repositories/` — veri erişimi **arayüzleri** (port). Implementasyon `data`'da.
- `services/` — domain servis **arayüzleri** (ör. `AudioPlayerService` portu).
- `usecases/` — tek bir iş akışı (ör. `GetShowCatalog`, `PlayEpisode`). UI ve
  CarPlay bu use case'leri çağırır.

### `src/data` — Veri Katmanı
`domain`'deki repository arayüzlerini gerçekler.
- `dto/` — dış dünyadan gelen ham veri şekilleri (RSS parse çıktısı).
- `mappers/` — DTO → domain entity dönüşümü.
- `datasources/remote/` — RSS/HTTP'den veri çeken kaynaklar.
- `datasources/local/` — cache / kalıcı depolama kaynakları.
- `repositories/` — arayüzlerin somut implementasyonları (kaynakları birleştirir).

### `src/infrastructure` — Teknik Adaptörler
Somut, üçüncü parti teknolojilerin sarmalayıcıları. `domain` portlarını gerçekler.
- `network/` — HTTP istemcisi (fetch/axios sarmalayıcı).
- `rss/` — RSS/XML parser sarmalayıcı.
- `audio/` — `react-native-track-player` tabanlı `AudioPlayerService` implementasyonu.
- `storage/` — kalıcı depolama motoru (ör. MMKV / AsyncStorage) sarmalayıcı.

> Not: `data` "veriyi nereden alırım" sorusuna, `infrastructure` "hangi teknolojiyle"
> sorusuna cevap verir. RSS datasource, ham HTTP+parse işini infrastructure'a devreder.

### `src/presentation` — Mobil UI (React Native)
Kullanıcının gördüğü ekranlar. Feature bazlı organize.
- `navigation/` — React Navigation stack/tab tanımları ve tipleri.
- `features/<özellik>/` — her özellik kendi `screens/`, `components/`, `hooks/`'u ile.
- `shared/` — ortak bileşenler, tema, ortak hook'lar.
- `stores/` — Zustand global UI/player state.
- `providers/` — React Query, tema vb. sağlayıcılar.
- `query/` — TanStack Query anahtarları ve query fonksiyonları (use case'leri sarar).

### `src/carplay` — Apple CarPlay Yüzeyi
CarPlay ayrı bir sunum yüzeyidir; kendi şablonları (template) vardır ama **aynı
domain use case'lerini** kullanır. UI kodu paylaşılmaz, iş mantığı paylaşılır.
- `templates/` — CarPlay şablon tanımları (list, nowPlaying…).
- `controllers/` — şablon yaşam döngüsü ve etkileşim yönetimi.
- `scene/` — CarPlay scene bağlantısı (bootstrap).

### `src/app` — Composition Root
Her şeyin birbirine bağlandığı tek yer. Bağımlılıklar burada oluşturulup enjekte
edilir (`composeDependencies`). Kök navigasyon ve sağlayıcılar burada kurulur.

> Bir DI **container**'ı YOKTUR: bağımlılıklar tek bir fonksiyonda elle
> kurulur. Kayıt/çözümleme makinesi eklemek, tek bir grafik için gereksiz bir
> dolaylılık katmanı olurdu.

---

## 3. Örnek Akış: "Bir şovun bölümlerini listele"

```
presentation (EpisodeListScreen)
   └─ useQuery → query/episodeQueries
        └─ GetPodcastFeed use case            (domain)
             └─ PodcastFeedRepository (port)   (domain arayüzü)
                  └─ PodcastFeedRepositoryImpl (data)
                       └─ RssFeedDataSource    (data/remote)
                            ├─ httpClient       (infrastructure/network)
                            └─ rssParser        (infrastructure/rss)
```

UI yalnızca `GetPodcastFeed` use case'ini tanır. Alttaki her şey enjekte edilir;
yarın RSS yerine bir REST API gelirse sadece `data` katmanı değişir, UI'a dokunmayız.

---

## 4. Yeni Özellik Eklerken

1. **Entity mi gerekiyor?** → `domain/entities`.
2. **Yeni veri kaynağı mı?** → `domain/repositories`'e port, `data`'ya impl.
3. **Yeni iş akışı mı?** → `domain/usecases`'e bir use case.
4. **Ekran mı?** → `presentation/features/<özellik>`.
5. **Bağlantıyı** `app/di` içinde kur.

Her zaman **dıştan içe değil, içten dışa** düşün: önce domain, sonra data,
en son UI.

---

## 5. Seçilen Teknolojiler

| Alan | Tercih | Neden |
|------|--------|-------|
| Server state | **TanStack Query** | cache, retry, background refetch hazır |
| UI/player state | **Zustand** | hafif, boilerplate'siz |
| Navigasyon | **React Navigation** | RN standardı |
| Audio | **react-native-track-player** | arka plan oynatma, lock screen, CarPlay |
| CarPlay | **react-native-carplay** | native CarPlay şablonları |
| RSS parse | **fast-xml-parser** | hızlı, saf JS, bağımlılıksız |
| Depolama | **react-native-mmkv** | hızlı kalıcı depolama (cache/ayarlar) |
| Offline indirme | **react-native-blob-util** | (sonraki faz — mimaride yeri hazır) |

Yol takma adları (`@core`, `@domain`, `@data` …) `tsconfig.json` ve
`babel.config.js` içinde tanımlıdır; import'lar kısa ve okunur olsun diye.
