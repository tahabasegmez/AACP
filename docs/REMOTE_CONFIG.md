# Remote Config — Dinamik Şov Kataloğu

Bu belge, AA şov listesini **uygulama güncellemesi olmadan** yönetmeyi sağlayan
uzak (remote) katalog sistemini anlatır: nasıl çalışır, sunucuda nasıl kurulur,
yeni şov nasıl eklenir.

## 1. Neden ve nasıl (hibrit model)

Şov listesi iki kaynaktan gelebilir:

1. **Bundled (koda gömülü)** — [src/core/config/feedCatalog.ts](../src/core/config/feedCatalog.ts).
   Her zaman vardır; ilk açılış ve çevrimdışı durumda güvenlik ağıdır.
2. **Remote (uzak JSON)** — sunucuda barındırılan bir `shows.json`. Erişilebildiğinde
   **yetkili (authoritative)** kaynaktır.

Uygulamanın izlediği öncelik ([HybridShowCatalogRepository](../src/data/repositories/HybridShowCatalogRepository.ts)):

```
1) TTL içinde önbelleğe alınmış uzak katalog varsa → onu kullan (ağa çıkma)
2) Yoksa uzak JSON'u çek → başarılıysa önbelleğe al ve kullan
3) Uzak çekim başarısızsa → bayat önbellek varsa onu, yoksa BUNDLED'ı kullan
```

Sonuç:
- **Yeni şov = `shows.json`'a bir satır** → app güncellemesi yok.
- Sunucu erişilemese/çökse bile uygulama çalışır (bundled fallback).
- `remoteCatalogUrl` boşsa sistem birebir bundled-only davranır (uzak devre dışı).

## 2. JSON şeması

`shows.json`, `FeedCatalogEntry` nesnelerinden oluşan bir **dizi** olmalıdır:

```json
[
  {
    "slug": "bir-bakista",
    "feedUrl": "https://feeds.transistor.fm/bir-bakista",
    "title": "Bir bakışta",
    "imageUrl": "https://img.transistorcdn.com/.../artwork.webp",
    "description": "Adı üstünde. Bir bakışta gündemdeki konuları uzmanlarla değerlendiriyor."
  }
]
```

| Alan | Zorunlu | Açıklama |
|------|:------:|----------|
| `slug` | ✅ | Kararlı benzersiz kimlik (Transistor slug'ı). |
| `feedUrl` | ✅ | Şovun RSS feed URL'i. |
| `title` | ✅ | Liste ekranında görünen başlık. |
| `imageUrl` | ➖ | Kapak görseli. |
| `description` | ➖ | Kısa açıklama. |

**Doğrulama & güvenlik** ([RemoteCatalogDataSource](../src/data/datasources/remote/RemoteCatalogDataSource.ts)):
- JSON bir dizi değilse → tüm uzak veri reddedilir, fallback devreye girer.
- `slug`/`feedUrl`/`title`'ı eksik olan **tek tek** girişler sessizce atlanır
  (bir bozuk kayıt tüm listeyi düşürmez).
- **Boş dizi (`[]`) hatalı sayılır** → fallback. (Yanlış bir deploy'un tüm şovları
  gizlemesini önlemek için. Bir şovu gizlemek istiyorsan listeden çıkar ama listeyi
  hiç boş bırakma.)

## 3. Uygulamayı uzak kataloga bağlama

[src/core/config/env.ts](../src/core/config/env.ts) içinde:

```ts
export const env: AppEnv = {
  // ...
  remoteCatalogUrl: 'https://<sunucu>/aacp/shows.json', // ← doldur
  remoteCatalogTtlMs: 6 * 60 * 60_000,                  // 6 saat (istenirse değiştir)
};
```

- `remoteCatalogUrl` verilene kadar uygulama bundled-only çalışır (güvenli varsayılan).
- `remoteCatalogTtlMs`: uzak katalog bu süre boyunca önbellekten okunur; süre dolunca
  bir sonraki açılış/istekte yeniden çekilir. Kısa TTL = daha hızlı güncelleme,
  daha çok istek; uzun TTL = tersi.
- İleride ortam bazlı (dev/staging/prod) farklı URL'ler için `env` bir build
  değişkeninden (ör. `react-native-config`) beslenebilir; kod değişmez.

## 4. Sunucuda kurulum (deploy seçenekleri)

`shows.json` **statik bir dosyadır**; herhangi bir statik barındırma yeter. Sunucu
tarafı kod GEREKMEZ.

Gereksinimler:
- **HTTPS zorunlu** — iOS App Transport Security düz HTTP'yi engeller.
- **`Content-Type: application/json`** döndür (uygulama yine de metni parse eder ama doğrusu budur).
- **CORS gerekmez** — istek native tarafından yapılır (tarayıcı değil). (İleride web
  sürümü olursa `Access-Control-Allow-Origin` gerekir.)
- **Cache header'ları** (opsiyonel): `Cache-Control: max-age=...` CDN/edge önbelleği
  için; uygulama zaten kendi TTL'ini uygular.

Seçenekler:
- **Şirket web sunucusu** — `https://aa.com.tr/.../shows.json` gibi bir yola koy.
- **Nesne depolama + CDN** — AWS S3 + CloudFront, GCS, Azure Blob (public read).
- **GitHub Pages / raw** — hızlı başlangıç/test için (prod için şirket alan adı önerilir).

## 5. Yeni şov ekleme akışı (operasyon)

1. `shows.json`'a yeni girişi ekle (slug + feedUrl + title, tercihen imageUrl + description).
2. Dosyayı sunucuya deploy et.
3. Kullanıcılar, önbellek TTL'i dolduğunda ya da sonraki açılışta yeni şovu görür.
   (Anında yaymak istersen TTL'i düşük tut.)
4. **Rollback:** eski `shows.json`'a geri dön ve tekrar deploy et.

> İpucu: Bundled listeyi de ara sıra remote ile eşitle. Bundled, remote'un hiç
> çekilemediği ilk-açılış/offline senaryosunun güvenlik ağıdır; çok eskirse yeni
> kullanıcılar ilk açılışta eksik liste görebilir.

## 6. Feed URL'lerini bulma (slug ↔ feed)

Slug her zaman başlıktan türemez (ör. "Analiz ve görüşler" → `anadolu-ajansi`).
Doğru `feedUrl`'i bulmak için:
- Şovun Apple Podcasts sayfasındaki ID ile: `https://itunes.apple.com/lookup?id=<APPLE_ID>`
  yanıtındaki `feedUrl` alanı gerçek RSS adresini verir.
- Ya da Transistor panelinden şovun feed adresini kopyala.

## 7. Yerel test

`remoteCatalogUrl`'i geçici olarak bir test URL'ine (ör. bir GitHub gist raw linki
veya `python -m http.server` ile yerel bir dosya) yönlendirip davranışı doğrula:
- Geçerli JSON → uzak liste görünür.
- Sunucuyu kapat → bir sonraki TTL sonrası bayat önbellek/bundled fallback devreye girer.

İlgili testler: [HybridShowCatalogRepository.test.ts](../src/data/repositories/__tests__/HybridShowCatalogRepository.test.ts)
tüm bu senaryoları (remote başarı/başarısızlık, cache, boş liste, geçersiz giriş) kapsar.
