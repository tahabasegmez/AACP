# Veri mimarisi

Hangi veri nerede yaşar ve neden.

## 1. Karar kuralı

Bir veri kümesi için sırayla sorulur:

1. **Sorgulanıyor mu?** (join, filtre, rapor, "kim/kaç tane") → **PostgreSQL**
2. **Bütünlük ve denetim izi gerekiyor mu?** (para, abonelik) → **PostgreSQL**
3. **Yazma hacmi yüksek ve ilişkisiz mi?** (anahtarla eriş, join yok) → **NoSQL**

Sıralama önemlidir: NoSQL yalnızca ilk iki soruya "hayır" denen veriler için
kullanılır. "Hızlı olsun" tek başına gerekçe değildir.

## 2. Yerleşim

### PostgreSQL (Supabase)

| Tablo | İçerik | Neden ilişkisel |
|---|---|---|
| `auth.users` | Giriş bilgileri | Supabase Auth'a ait |
| `profiles` | Ad, avatar | Kullanıcıya 1-1; auth tablosu genişletilmez |
| `subscriptions` | Plan ve durum | Sunucu dışında DEĞİŞTİRİLEMEZ olmalı |
| `payments` | Ödeme kayıtları | Mutabakat, iade takibi, denetim izi |
| `shows` | Şov kataloğu | Yönetilir, sıralanır, yayın durumu sorgulanır |
| `episodes` | RSS'ten türeyen bölümler | Arama, "yeni bölümler", sunucu tarafı liste |
| `show_follows` | Takipler (izdüşüm) | "Bu şovu kimler takip ediyor" her taramada sorulur |
| `sync_records` | Listeler, sonra dinle, takipler | Kütüphane verisi; raporlanabilir |
| `push_registrations` | Cihaz jetonları | Kullanıcıya bağlı, silinmesi gerekir |
| `analytics_events` | Telemetri | Toplu sorgu ve raporlama |

### NoSQL (Redis → KV → Postgres)

| Koleksiyon | İçerik | Neden anahtar-değer |
|---|---|---|
| `progress` | Kaldığın yer / dinlendi | **En yüksek yazma hacmi**: bir bölüm dinlenirken konum sürekli güncellenir. İlişkisiz, anahtarla erişilir, join gerektirmez |
| `preferences` | Kullanıcı tercihleri | Küçük bayraklar; sorgulanmaz, kullanıcı başına okunur |

Bu iki koleksiyon için üç kademeli bir yerleşim vardır ve sırayla denenir:

| Kademe | Koşul | Delta okuma maliyeti |
|---|---|---|
| **Redis** | `REDIS_URL` + `REDIS_TOKEN` | **Değişen** kayıt sayısıyla orantılı |
| Cloudflare KV | `USER_STATE` bağlı | **Toplam** kayıt sayısıyla orantılı |
| Postgres | hiçbiri yok | İndeksli sorgu |

**Neden Redis öne geçti.** Delta senkron "şu andan sonra değişenleri ver"
sorusudur. KV bu soruyu cevaplayamaz: tüm anahtarlar listelenir, her biri
ayrı ayrı okunur ve filtre bellekte uygulanır. 2.000 bölüm dinlemiş bir
kullanıcıda 3 kayıt değişmiş olsa bile **2.000 okuma** yapılır — her senkronda,
her cihazda. Ücretsiz katmandaki 100.000 günlük okuma bu kullanıcının ~50
senkronuna yeter.

Redis'te dizin bir **sıralı kümedir**: skor `updatedAt`, üye kayıt anahtarı.
`ZRANGEBYSCORE` yalnızca değişenleri sıralı biçimde döner.

```
<koleksiyon>:<kullanıcıId>:z   → sıralı dizin (skor = updatedAt)
<koleksiyon>:<kullanıcıId>:h   → gövdeler (alan = kayıt anahtarı)
```

KV anahtar düzeni: `<koleksiyon>:<kullanıcıId>:<kayıtAnahtarı>`.

> **Tutarlılık:** KV nihai tutarlıdır (yazma diğer bölgelere saniyeler içinde
> yayılır). "Kaldığın yer" bilgisinin bir cihazdan diğerine birkaç saniyede
> geçmesi kabul edilebilir. **Para ve abonelik verisi bu yüzden KV'de tutulmaz.**

## 3. Rotalar yerleşimi bilmez

```
/v1/sync/:collection
   └─ resolveStore(env, collection)     ← TEK karar noktası
        ├─ PostgresSyncStore            ← sync_records + RLS
        ├─ RedisSyncStore               ← sıralı küme + hash
        └─ KvSyncStore                  ← Cloudflare KV
```

[`SyncStore`](../worker/src/storage/SyncStore.ts) portu iki tarafta da aynı
sözleşmeyi sunar: **delta okuma + son-yazan-kazanır yazma**. Bir koleksiyonu
taşımak, [`resolveStore`](../worker/src/storage/resolveStore.ts) içindeki
yerleşim tablosunda tek satır değiştirmektir; rota kodu ve istemci etkilenmez.

**KV bağlanmamışsa** NoSQL koleksiyonları Postgres'e düşer. Eksik yapılandırma
servisi düşürmez; yalnızca yerleşim değişir ve `/v1/health` bunu bildirir.

### Son-yazan-kazanır iki tarafta da korunur

| Taraf | Nasıl |
|---|---|
| Postgres | `trg_sync_keep_newest` tetikleyicisi — karşılaştırma ATOMİKTİR |
| Redis | Lua script — karşılaştırma ve yazma tek parça çalışır, ATOMİKTİR |
| KV | Oku-karşılaştır-yaz. KV atomik karşılaştırma sunmaz; aynı anahtara eşzamanlı yazma tek kullanıcının tek bölümü için gerçekleşir ve kaybedilen yazma sonraki turda düzelir |

## 4. Katalog artık veritabanında

**Uygulamaya gömülü şov listesi kaldırıldı.** Katalog `shows` tablosunda yaşar:

- Şov eklemek/çıkarmak = bir satır işlemi, uygulama güncellemesi gerekmez,
- yayından kaldırmak SİLMEK değildir (`active = false`) — geçmiş dinleme
  kayıtları şova referans verir,
- bölümler feed taramasında `episodes` tablosuna işlenir (feed zaten
  bildirim için indiriliyor; ikinci bir iş çalıştırmak gereksiz).

| Uç | Yetki | İş |
|---|---|---|
| `GET /v1/catalog` | herkes | Yayındaki şovlar (istemcinin kaynağı) |
| `GET /v1/catalog/shows/:slug/episodes` | herkes | Şovun bölümleri |
| **`POST /v1/catalog/import`** | admin | **Katalogu otomatik doldur** (§4.1) |
| **`POST /v1/push/scan`** | admin | Feed taraması; `{"backfill":true}` ile tüm arşiv (§4.2) |
| `POST /v1/catalog/shows` | admin | Şov bilgisini ELLE ver (istisna) |
| `DELETE /v1/catalog/shows/:slug` | admin | Yayından kaldır (`active=false`) |

### 4.1 Katalog otomasyonu

**Şov bilgisi elle girilmez.** Aktarım feed'in kendisini yetkili kaynak sayar:
başlık, açıklama, kapak, yazar, dil ve kategoriler `<channel>` bloğundan okunur.
Yayıncı bir şeyi değiştirdiğinde katalog kendiliğinden düzelir.

Tek girdi **RSS adresidir**. Barındırıcıya özel bir keşif API'sine (Transistor
vb.) bağlanmak, barındırıcı değiştiğinde sunucuyu da değiştirmek demekti; RSS
ise her sağlayıcıda çalışan ortak arayüzdür.

```
POST /v1/catalog/import
  { feedUrls: [] } → verilen adresler aktarılır (yeni şov eklemenin yolu)
  gövde boş        → KATALOGDAKİ şovların bilgisi tazelenir (cron'un işi)
```

Komut satırından:

```bash
cd worker
npm run catalog:import https://feeds.transistor.fm/bir-bakista   # şov ekle
npm run catalog:import                                           # hepsini tazele
```

> **Jeton nerede durur:** `API_URL` ve `ADMIN_TOKEN` ya ortam değişkenidir ya
> da `worker/.dev.vars` içindedir (git'e girmez). Kök `.env`'e YAZILMAZ:
> react-native-config oradaki her değişkeni derlenen IPA'ya gömer ve yönetim
> jetonu uygulamayla birlikte dağıtılırdı.

**Cron her turda katalogdaki şovları tazeler** (30 dk): kapak, başlık ve
açıklama yayıncıyı takip eder. Tazeleme, bölüm taramasından ÖNCE çalışır ki
aynı turda eklenen bir şovun bölümleri de taranıp takipçilere bildirim gitsin.

Yeni şovun katalogda belirmesi ise bilinçli bir karardır — feed adresi açıkça
verilir. Böylece yayıncının test amaçlı açtığı bir şov uygulamada kendiliğinden
görünmez.

| Alan | Aktarımda | Neden |
|---|---|---|
| başlık, açıklama, kapak, yazar, dil, kategoriler | **yazılır** | Feed yetkili kaynak |
| `active`, `sort_order` | **yazılmaz** | Yönetim kararı; otomasyon yayından kaldırılmış şovu geri açmamalı, elle verilen sırayı bozmamalı |

> Şov kimliği (`slug`) feed adresinin son parçasından türer ve **istemcideki
> kuralla birebir aynıdır**. İki taraf ayrışsaydı dinleme kayıtları şovla
> eşleşmezdi; bu yüzden testle sabitlenmiştir.

### 4.2 Bölüm arşivi ve tarama

Arşivler büyüktür: tek bir şovda 1900'ü aşkın bölüm, ~4 MB feed. Bu yüzden iş
ikiye ayrılmıştır:

| | Ne yapar | Ne zaman |
|---|---|---|
| Rutin tarama (cron, 30 dk) | En yeni **100** bölüme bakar | Sürekli |
| `npm run episodes:backfill` | **Tüm arşivi** işler | Yeni şov eklendiğinde, bir kez |

Rutin turun tek sorusu "yeni bölüm çıktı mı" olduğu için en yeniler yeter.

**Değişmemiş feed hiç indirilmez.** Yayıncının verdiği `ETag`/`Last-Modified`
şov satırında saklanır ve bir sonraki turda koşullu istekle geri gönderilir;
sunucu 304 dönerse indirme, ayrıştırma ve yazma adımlarının tamamı atlanır.
Feed'lerin ezici çoğunluğu iki tur arasında değişmediği için kazanç şov
sayısıyla doğru orantılıdır.

**Tarama şov başına bir kuyruk işidir.** "Hepsini tek cron turunda sırayla
tara" yaklaşımı şov sayısı büyüdükçe çöker — 5.000 şov × ~1 sn hiçbir
çalıştırma penceresine sığmaz. Cron artık yalnızca işleri
[Cloudflare Queues](https://developers.cloudflare.com/queues/)'a dağıtır;
tüketiciler paralel çalışır, başarısız iş kendi başına yeniden denenir ve bir
şovun hatası diğerlerini etkilemez.

> Kuyruk bağlı değilse tarama sınırlı sayıda şov için satır içi çalışır. Eksik
> yapılandırma servisi düşürmez; yalnızca ölçek özelliği devre dışı kalır.
> Hangi kipin çalıştığı yanıttaki `mode` alanında görünür.

### 4.3 Bölüm listesi istemciye nereden gider

İstemci artık şov açılışında RSS'i KENDİSİ İNDİRMEZ; bölümleri
`GET /v1/catalog/shows/:slug/episodes` ucundan sayfa sayfa alır.

Sayfalama **imleçlidir** (keyset), offset değil:

- `offset 10000` veritabanına her seferinde ilk 10.000 satırı saydırır; imleç
  indekste doğrudan yerini bulur ve 50. sayfa 1. sayfa kadar ucuzdur,
- offset, araya yeni bölüm girdiğinde sayfa sınırlarını kaydırır ve kullanıcı
  aynı bölümü iki kez görür.

Sıralama `(published_sort, guid)` çiftidir. `published_sort` üretilmiş bir
sütundur (`coalesce(published_at, created_at)`) çünkü imleç sayfalaması
sıralanan sütunun **boş olmamasını** gerektirir — NULL karşılaştırması daima
yanlış döner ve tarihi çözülemeyen bölümler sayfalar arasında kaybolurdu.

İstemci tarafında kaynak seçimi tek yerdedir:

```
EpisodePageRepository (port)
   ├─ ApiEpisodePageRepository    ← sunucu, gerçek keyset
   ├─ FeedEpisodePageRepository   ← RSS + bellekte sayfalama
   └─ FallbackEpisodePageRepository  ← önce sunucu, İLK SAYFADA olmazsa RSS
```

Yedeğe düşme yalnızca ilk sayfada olur: sayfalar arasında kaynak değiştirmek,
imlecin karşı tarafta anlamsız olması ve kullanıcının listenin başına
dönmesi demekti.

> **Bölüm kapağı boşsa şov kapağına düşülür** — ve bu YAZARKEN değil, okurken
> yapılır. Yayıncıların çoğu `<item>` içine `itunes:image` koymaz; yedek okuma
> anında uygulandığı için şov kapağı değiştiğinde tüm bölümler kendiliğinden
> düzelir. İstemcideki RSS yolu da aynı kuralı uygular.

### 4.3 Katalog sırası

Liste **en son yayınlanan şov üstte** gelir. Sıra, her şovun en yeni bölümünün
tarihinden hesaplanır; `sort_order` bir yönetim kancası olarak önde durur ve
varsayılan `0` bırakıldığında hiçbir etkisi yoktur — bir şovu tepeye
sabitlemek gerektiğinde tek satırla yapılır. Hiç bölümü olmayan (henüz
taranmamış) şov sona düşer, eşitlik başlığa göre çözülür ki sıra turdan tura
oynamasın.

İstemci tarafında
[`RemoteShowCatalogRepository`](../src/data/repositories/RemoteShowCatalogRepository.ts)
katalogu çeker ve önbelleğe alır. **Gömülü yedek liste yoktur:** ilk açılışta ağ
yoksa katalog boş gelir, sonraki açılışlarda önbellek devreye girer. İki ayrı
kaynak tutmak, ikisinin sessizce ayrışması demekti — tek kaynak sunucudur.

> Boş bir uzak liste hatalı deploy sayılır ve önbelleğe YAZILMAZ; tüm şovların
> yanlışlıkla gizlenmesi böyle önlenir.

## 5. Kurulum

```bash
# 1. Şema (Supabase Studio → SQL Editor, sırayla)
worker/supabase/schema.sql
worker/supabase/schema-02-catalog-and-billing.sql
worker/supabase/schema-03-avatars.sql
worker/supabase/schema-04-episode-paging.sql
worker/supabase/schema-05-feed-scan.sql

# 2. NoSQL namespace'i
cd worker
npx wrangler kv namespace create USER_STATE
# çıkan id'yi wrangler.toml içindeki [[kv_namespaces]] bloğuna yazıp yorumu kaldırın

# 2b. Tarama kuyruğu
# Ücretsiz planda saklama süresi 24 saate SABİTTİR; açıkça verilmezse
# wrangler paid varsayılanını (4 gün) ister ve istek reddedilir.
npx wrangler queues create aacp-feed-scan --message-retention-period-secs 86400

# 2c. (opsiyonel) Redis — kaldığın yer ve tercihler için
npx wrangler secret put REDIS_URL
npx wrangler secret put REDIS_TOKEN

# 3. Yayınla
npx wrangler deploy

# 4. Yönetim jetonunu yerine koy (git'e girmez)
cp .dev.vars.example .dev.vars   # ADMIN_TOKEN + API_URL doldurun

# 5. Katalogu doldur — şov bilgisi elle girilmez, feed'den okunur
npm run catalog:import

# 6. Bölüm arşivini bir kez doldur
npm run episodes:backfill
```

Son iki adım bir kereliktir: sonrasında cron her 30 dakikada bir katalogu
tazeler ve yeni bölümleri yakalar. Katalog doldurulmadan uygulama şov listesini
boş görür — gömülü liste artık yoktur.

## 6. Sonraki adımlar

- **Ödeme sağlayıcısı entegrasyonu.** Tablolar hazır (`subscriptions`,
  `payments`) ama webhook ucu yok. Abonelik durumunu YALNIZCA sunucu
  değiştirebilmeli — RLS'te yazma politikası bilinçli olarak tanımlanmadı.
- **Katalog sırası hâlâ istekte hesaplanıyor.** `GET /v1/catalog`, şov başına
  gömülü bir alt sorguyla en son bölüm tarihini çekiyor ve sayfalaması yok;
  şov sayısı büyüdükçe lineer büyür. Doğru hâli `shows` üzerinde denormalize
  bir `last_published_at` sütunu + indeks + imleçli sayfalama.
- **`analytics_events` sınırsız büyüyor.** Supabase'in 500 MB'ını ilk
  dolduracak tablo bu; zaman serisi verisi OLTP tablosunda durmamalı.
- **Hesap silme / veri dışa aktarma yok (KVKK).** Postgres tarafı
  `on delete cascade` ile bağlı ama Redis/KV'deki kayıtlar cascade'e tabi
  değil; hesap silinse orada öksüz veri kalır.
- **Liste ve "sonra dinle" izdüşümü.** Takipler için yapıldı (`show_follows`);
  aynı desen listelere de uygulanabilir.
