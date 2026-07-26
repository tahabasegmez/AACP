# AACP Backend — Kurulum ve Mimari

Bu belge `server/` altındaki servisi anlatır: ne yapar, nasıl kurulur, uygulama
ona nasıl bağlanır ve neyin eksik olduğu.

> **Sunucudan bağımsızlık:** Servis hiçbir makineye özgü varsayım yapmaz. Aynı
> imaj ve aynı `.env` şeması Raspberry Pi 5'te (arm64), kurumsal bir sunucuda ya
> da kiralık bir VPS'te (amd64) çalışır. Değişen tek şey `.env` içeriğidir.

## 1. Ne sağlar

| Uç | Yöntem | Kimlik | Açıklama |
|----|--------|--------|----------|
| `/health` | GET | — | Sağlık kontrolü (Docker healthcheck kullanır) |
| `/v1/auth/device` | POST | — | Cihaz kimliğiyle anonim oturum → jeton |
| `/v1/catalog` | GET | — | Şov kataloğu (uygulamanın okuduğu `shows.json`) |
| `/v1/catalog` | POST | admin | Katalog yayınlama |
| `/v1/sync/:collection` | GET | jeton | Delta çekme (`progress`, `follows`, `saved`) |
| `/v1/sync/:collection` | POST | jeton | Delta gönderme |
| `/v1/analytics` | POST | ops. | Kullanım telemetrisi (toplu) |
| `/v1/push/register` | POST | jeton | Push jetonu kaydı |
| `/v1/push/unregister` | POST | jeton | Push jetonu silme |
| `/v1/transistor/:resource` | GET | — | Transistor API proxy'si (anahtar sunucuda kalır) |

## 2. Mimari

```
server/src/
  main.ts              → süreç yönetimi, düzgün kapanış
  app.ts               → COMPOSITION ROOT: tüm bağımlılıklar burada bağlanır
  config/env.ts        → ortam değişkenleri (tek okuma noktası)
  core/
    http/router.ts     → bağımlılıksız minimal router
    http/middleware.ts → CORS, oran sınırı, kimlik çözümü
    errors.ts, logger.ts
  storage/
    Store.ts           → kalıcılık PORTU
    SqliteStore.ts     → tek dosyalık SQLite adaptörü (varsayılan)
    MemoryStore.ts     → bellek-içi adaptör (test)
  modules/
    auth/ catalog/ sync/ analytics/ push/ transistor/
```

Mobil uygulamayla aynı ilkeler geçerlidir: **port/adapter**, tek composition
root, modüller birbirini `new`'lemez. Postgres'e geçmek = `Store` portunu
implement eden yeni bir sınıf + `app.ts`'te bir satır.

### Senkron modeli

**Delta + son-yazan-kazanır.** Her kayıt `updatedAt` (epoch ms) taşır; sunucu
daha yeni olanı saklar (`WHERE excluded.updated_at > sync_records.updated_at`).
Silmeler `deleted` bayrağıyla (tombstone) taşınır ki bir cihazdaki silme
diğerine ulaşsın. İstemci son gördüğü damgayı (`cursor`) saklar ve yalnızca
sonrasını ister — böylece trafik minimumdur.

## 3. Kurulum

### Docker (önerilen)

```bash
cd server
cp .env.example .env
# AUTH_SECRET üret ve .env'e yaz:
openssl rand -hex 32

docker compose up -d --build
curl http://localhost:8080/health
```

Veriler `aacp-data` adlı Docker volume'ünde (`/data`) yaşar: SQLite dosyası ve
isteğe bağlı `shows.json`. Yedekleme = bu volume'ü kopyalamak.

### Docker'sız (systemd, doğrudan Node)

```bash
cd server
npm ci
npm run build
NODE_ENV=production AUTH_SECRET=... DATA_DIR=/var/lib/aacp node dist/main.js
```

### HTTPS (zorunlu)

Servis düz HTTP konuşur. iOS App Transport Security düz HTTP'ye izin vermez, bu
yüzden **önüne bir ters proxy koyup TLS'i orada sonlandırın**. Caddy ile en kısa
yol (otomatik Let's Encrypt sertifikası):

```
podcast.example.com {
    reverse_proxy localhost:8080
}
```

nginx/Traefik de aynı işi görür; servis tarafında değişiklik gerekmez.

## 4. Kataloğu yayınlama

Katalog tek kaynakta yaşar: [src/core/config/feedCatalog.ts](../src/core/config/feedCatalog.ts).
Sunucuya gidecek JSON bundan üretilir:

```bash
node scripts/generate-shows-json.js server/data/shows.json
```

İki yayınlama yolu (ikisi de aynı sonucu verir):

1. **Dosya olarak** — `shows.json`'u sunucudaki `DATA_DIR` içine kopyalayın.
2. **API ile** (sunucu çalışırken, `ADMIN_TOKEN` gerekir):

```bash
curl -X POST https://podcast.example.com/v1/catalog \
     -H "x-admin-token: $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     --data @server/data/shows.json
```

Boş katalog reddedilir (yanlış bir deploy tüm şovları gizlemesin diye).

## 5. Uygulamayı bağlama

Mobil taraf tek bir değere bakar: `apiBaseUrl`
([src/core/config/env.ts](../src/core/config/env.ts)).

```ts
production: {
  ...base,
  name: 'production',
  apiBaseUrl: 'https://podcast.example.com',
  ...
}
```

Ya da build zamanı değişkeniyle (kod değişmeden, `react-native-config` kurulunca):
`APP_API_BASE_URL=https://podcast.example.com`

**Bağlanınca kendiliğinden açılan özellikler:** uzak katalog (`/v1/catalog`),
cihazlar arası senkron, telemetri. `apiBaseUrl` boşsa uygulama tamamen yerel
çalışır ve hiçbir akış kırılmaz — bu bilinçli bir tasarım kararıdır.

## 6. Transistor API'sine geçiş

Bugün bölümler RSS'ten okunuyor. Transistor API'sine geçmek için:

```ts
// src/core/config/env.ts
episodeSource: 'transistor',
```

Uygulama, `apiBaseUrl` tanımlıysa istekleri `/v1/transistor/*` proxy'sine yapar
ve **API anahtarı istemciye hiç gitmez** (sunucudaki `TRANSISTOR_API_KEY`
kullanılır). Repository, use case ve UI katmanları bu geçişten etkilenmez —
kaynak bir stratejidir ([FeedSource](../src/data/datasources/remote/FeedSource.ts)).

## 7. Güvenlik notları

- `AUTH_SECRET` üretimde **zorunlu** sayılmalı; verilmezse yeniden başlatmada
  tüm oturumlar düşer.
- `ADMIN_TOKEN` boşsa yönetim uçları tamamen kapalıdır (güvenli varsayılan).
- Oran sınırı IP başına dakikada `RATE_LIMIT_PER_MIN` (varsayılan 120).
- İstek gövdeleri 1 MB ile sınırlıdır.
- Kullanıcı kimliği anonim UUID'dir; e-posta/ad gibi kişisel veri toplanmaz.

## 8. Eksik parçalar (bu turda tamamlanmadı)

### Push bildirimleri — yarım
**Var:** jeton kayıt/silme uçları, veritabanı tablosu, istemci sözleşmesi.
**Yok:**
- APNs/FCM'e bağlanan gönderici (sertifika/anahtar yönetimi dahil),
- takip edilen şovların feed'lerini periyodik tarayıp yeni bölüm saptayan
  zamanlanmış görev (worker),
- iOS tarafında bildirim izni isteme ve jetonu `/v1/push/register`'a gönderme
  (native kurulum gerektirir; Xcode'da Push Notifications capability).

### Hesap tabanlı kimlik — yok
Bugün yalnızca cihaz tabanlı anonim kimlik var. Kullanıcı telefonunu
değiştirdiğinde verisi taşınmaz. E-posta/SSO ile hesap eklenirse aynı
`users` tablosuna bağlanacak şekilde tasarlandı.

### Telemetri paneli — yok
Olaylar `analytics_events` tablosuna yazılır ama görselleştirme/raporlama
arayüzü yoktur. SQL ile sorgulanabilir; ileride basit bir panel eklenebilir.

### Ölçekleme
Oran sınırı ve Transistor önbelleği **süreç-içi**dir; tek örnekli dağıtım
varsayılır. Yatay ölçekleme gerekirse bunlar paylaşımlı bir katmana (Redis)
taşınmalı ve `Store` Postgres'e geçmelidir.
