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

### NoSQL (Cloudflare KV)

| Koleksiyon | İçerik | Neden anahtar-değer |
|---|---|---|
| `progress` | Kaldığın yer / dinlendi | **En yüksek yazma hacmi**: bir bölüm dinlenirken konum sürekli güncellenir. İlişkisiz, anahtarla erişilir, join gerektirmez |
| `preferences` | Kullanıcı tercihleri | Küçük bayraklar; sorgulanmaz, kullanıcı başına okunur |

Anahtar düzeni: `<koleksiyon>:<kullanıcıId>:<kayıtAnahtarı>`.

> **Tutarlılık:** KV nihai tutarlıdır (yazma diğer bölgelere saniyeler içinde
> yayılır). "Kaldığın yer" bilgisinin bir cihazdan diğerine birkaç saniyede
> geçmesi kabul edilebilir. **Para ve abonelik verisi bu yüzden KV'de tutulmaz.**

## 3. Rotalar yerleşimi bilmez

```
/v1/sync/:collection
   └─ resolveStore(env, collection)     ← TEK karar noktası
        ├─ PostgresSyncStore            ← sync_records + RLS
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

Adres bile vermek gerekmez: `TRANSISTOR_API_KEY` tanımlıysa yayıncı hesabındaki
şovlar **keşfedilir**.

```
POST /v1/catalog/import
  gövde boş        → hesaptaki tüm şovlar keşfedilir ve aktarılır
  { feedUrls: [] } → yalnızca verilen adresler aktarılır
```

Komut satırından:

```bash
cd worker
npm run catalog:import                                           # hepsi (keşif)
npm run catalog:import https://feeds.transistor.fm/bir-bakista   # tek şov
```

> **Jeton nerede durur:** `API_URL` ve `ADMIN_TOKEN` ya ortam değişkenidir ya
> da `worker/.dev.vars` içindedir (git'e girmez). Kök `.env`'e YAZILMAZ:
> react-native-config oradaki her değişkeni derlenen IPA'ya gömer ve yönetim
> jetonu uygulamayla birlikte dağıtılırdı.

**Cron her turda katalogu tazeler** (30 dk). Yeni bir şov açıldığında kimsenin
bir şey yapmasına gerek yoktur: aynı turda bölümleri de taranır ve takipçilere
bildirim gider — bu yüzden tazeleme, tarama SIRASINDAN ÖNCE çalışır.

| Alan | Aktarımda | Neden |
|---|---|---|
| başlık, açıklama, kapak, yazar, dil, kategoriler | **yazılır** | Feed yetkili kaynak |
| `active`, `sort_order` | **yazılmaz** | Yönetim kararı; otomasyon yayından kaldırılmış şovu geri açmamalı, elle verilen sırayı bozmamalı |

> Şov kimliği (`slug`) feed adresinin son parçasından türer ve **istemcideki
> kuralla birebir aynıdır**. İki taraf ayrışsaydı dinleme kayıtları şovla
> eşleşmezdi; bu yüzden testle sabitlenmiştir.

**Keşif yalnızca `TRANSISTOR_API_KEY` tanımlıysa çalışır.** Anahtar yoksa
argümansız aktarım hiçbir şey bulamaz (betik bunu açıkça söyler) ve cron'un
katalog tazelemesi de boşa döner — şovlar ancak adres verilerek eklenir.

### 4.2 Bölüm arşivi

Arşivler büyüktür: tek bir şovda 1900'ü aşkın bölüm, ~4 MB feed. Bu yüzden iş
ikiye ayrılmıştır:

| | Ne yapar | Ne zaman |
|---|---|---|
| Rutin tarama (cron, 30 dk) | En yeni **100** bölüme bakar | Sürekli |
| `npm run episodes:backfill` | **Tüm arşivi** işler | Yeni şov eklendiğinde, bir kez |

Rutin turun tek sorusu "yeni bölüm çıktı mı" olduğu için en yeniler yeter.
Tavanı kaldırmak, yarım saatte bir hiç değişmemiş binlerce satırı yeniden
yazmak olurdu.

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

# 2. NoSQL namespace'i
cd worker
npx wrangler kv namespace create USER_STATE
# çıkan id'yi wrangler.toml içindeki [[kv_namespaces]] bloğuna yazıp yorumu kaldırın

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
- **Bölüm listesini sunucudan sunmak.** `episodes` tablosu doluyor ve ucu
  hazır; istemci hâlâ RSS'i kendisi çekiyor. Geçiş, `FeedSource` stratejisine
  üçüncü bir implementasyon eklemektir (RSS / Transistor / API).
- **Liste ve "sonra dinle" izdüşümü.** Takipler için yapıldı (`show_follows`);
  aynı desen listelere de uygulanabilir.
