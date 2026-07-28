# Cloudflare + Supabase Kurulumu

AACP'nin sunucu tarafı iki yönetilen serviste çalışır:

| Katman | Servis | Ne yapar |
|---|---|---|
| API | **Cloudflare Workers** ([worker/](../worker/)) | REST uçları, kimlik proxy'si, zamanlanmış feed taraması |
| Veri + kimlik | **Supabase** | Postgres (senkron, telemetri, ayarlar) + Auth (hesaplar) |

Bakılacak sunucu, güncellenecek işletim sistemi, yedeklenecek disk yoktur.
Her ikisinin de ücretsiz katmanı bu uygulama için fazlasıyla yeterlidir.

> **Mimari not:** Uygulama **yalnızca Worker'ı tanır.** Supabase anahtarları
> uygulamaya gömülmez, Supabase SDK'sı istemcide bulunmaz. Kimlik sağlayıcısı
> ileride değişirse uygulama kodu etkilenmez.

---

## 1. Ön hazırlık

Hesaplar (ikisi de ücretsiz başlar):
- [Supabase](https://supabase.com) hesabı
- [Cloudflare](https://dash.cloudflare.com/sign-up) hesabı

Yerel araçlar:

```bash
npm install -g wrangler
wrangler login
```

## 2. Supabase projesi

1. Supabase Dashboard → **New project**.
   - Bölge: kullanıcılarına en yakın olanı seç (Türkiye için `eu-central-1`).
   - Veritabanı şifresini kaydet (bu şifreyi uygulamada kullanmayacaksın).
2. Proje açılınca **SQL Editor**'ı aç.
3. [worker/supabase/schema.sql](../worker/supabase/schema.sql) dosyasının
   tamamını yapıştır ve çalıştır.

Bu betik tabloları, indeksleri ve **Row Level Security** politikalarını kurar.
Tekrar çalıştırmak güvenlidir.

> **Neden RLS önemli:** Yetkilendirme uygulama kodunda değil, veritabanında
> zorunlu kılınır. Worker'da bir hata olsa bile bir kullanıcı başkasının
> satırlarını okuyamaz.

### 2.1 Anonim girişi aç

Uygulama, hesap açmadan da senkron yapabilsin diye anonim oturum kullanır.

**Authentication → Sign In / Providers → Anonymous sign-ins** → aç.

### 2.2 E-posta ayarları

**Authentication → Sign In / Providers → Email**:

- **Confirm email**: Kapalı bırakırsan kullanıcı kayıt olur olmaz girer
  (denemek için pratik). Açarsan uygulama "e-postanı doğrula" mesajı gösterir —
  bu durum kodda ele alınmıştır.
- Şifre sıfırlama e-postaları Supabase tarafından gönderilir; uygulamadaki
  `/v1/auth/reset-password` ucu bunu tetikler.

> Üretimde kendi SMTP'ni tanımla (**Project Settings → Auth → SMTP**);
> Supabase'in yerleşik gönderimi saatlik sıkı limitlere tabidir.

### 2.3 Anahtarları topla

**Project Settings → API** ve **→ Data API**:

| Değer | Nerede | Not |
|---|---|---|
| Project URL | Settings → API | `https://xxxx.supabase.co` |
| `anon` key | Settings → API | Herkese açık, RLS ile korunur |
| `service_role` key | Settings → API | **GİZLİ** — yalnızca Worker'da |
| JWT Secret | Settings → API → JWT Settings | **GİZLİ** — jeton doğrulama |

> `service_role` anahtarı RLS'i bypass eder. Asla uygulamaya, tarayıcıya ya da
> depoya girmemelidir.

## 3. Worker'ı yayınla

```bash
cd worker
npm install
```

### 3.1 Supabase adresini yaz

[worker/wrangler.toml](../worker/wrangler.toml) içindeki `[vars]` bölümüne
proje adresini gir (gizli değil):

```toml
[vars]
SUPABASE_URL = "https://xxxx.supabase.co"
APNS_BUNDLE_ID = "com.aa.podcast"
```

### 3.2 Gizli değerleri ekle

Bunlar `wrangler.toml`'a **yazılmaz**; Cloudflare'de şifreli saklanır:

```bash
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put SUPABASE_JWT_SECRET

# Katalog yayınlama gibi yönetim uçlarını korur.
# Üretmek için: openssl rand -hex 24
wrangler secret put ADMIN_TOKEN
```

`ADMIN_TOKEN` tanımlanmazsa yönetim uçları **kapalı** kalır (güvenli varsayılan).

### 3.3 Yayınla

```bash
npm run deploy
```

Çıktıdaki adresi not et: `https://aacp-api.<hesabın>.workers.dev`

Doğrula:

```bash
curl https://aacp-api.<hesabın>.workers.dev/health
# {"status":"ok","time":"...","supabase":true,"push":false}
```

`supabase: false` görüyorsan anahtarlar eksik.

## 4. Kataloğu yayınla

Katalog tek kaynakta yaşar (`src/core/config/feedCatalog.ts`). JSON'u üret:

```bash
# proje kökünde
node scripts/generate-shows-json.js shows.json
```

Yayınla:

```bash
curl -X POST https://aacp-api.tahabasegmez.workers.dev/v1/catalog \
     -H "x-admin-token: cce92ca569e3a5d382d704053cbfea643b45aff5fdd40ca1" \
     -H "Content-Type: application/json" \
     --data @shows.json
# {"count":11}
```

Doğrula:

```bash
curl https://aacp-api.<hesabın>.workers.dev/v1/catalog
```

> Yeni şov eklemek artık uygulama güncellemesi gerektirmez: `feedCatalog.ts`'i
> güncelle, betiği çalıştır, yukarıdaki komutu tekrarla.

## 5. Uygulamayı bağla

Proje kökünde:

```bash
cp .env.example .env
```

`.env` içinde:

```bash
APP_ENV=development
APP_API_BASE_URL=https://aacp-api.<hesabın>.workers.dev
```

Sonra **yeniden derle** (build zamanı değişkenleri; Metro'yu yeniden başlatmak
yetmez):

```bash
npx pod-install    # yalnızca iOS bağımlılıkları değiştiyse
npm run ios
```

Beklenen davranış:
- Şov listesi Worker'daki katalogdan gelir,
- **Ayarlar → Hesap** bölümü görünür,
- "Şimdi senkronla" çalışır,
- Bir bölümü yarıda bırakıp başka cihazda aynı hesapla açınca kaldığın yer gelir.

> `APP_API_BASE_URL` boş bırakılırsa uygulama tamamen yerel çalışır ve hiçbir
> akış kırılmaz — bu, güvenli varsayılandır.

## 6. Uçtan uca deneme

```bash
API=https://aacp-api.<hesabın>.workers.dev

# 1. Anonim oturum aç
TOKEN=$(curl -s -X POST $API/v1/auth/device | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 2. Senkron: veri gönder
curl -X POST $API/v1/sync/progress \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"records":[{"key":"ep-1","value":"{\"pos\":42}","updatedAt":'"$(date +%s000)"',"deleted":false}]}'

# 3. Geri oku
curl "$API/v1/sync/progress?since=0" -H "Authorization: Bearer $TOKEN"

# 4. Hesap oluştur (anonim kullanıcı YÜKSELTİLİR, veri korunur)
curl -X POST $API/v1/auth/register \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"deneme@ornek.com","password":"sifre12345"}'

# 5. Yeni jetonla aynı veriyi gör — kayıtlar taşınmış olmalı
```

**İzolasyon testi:** Yeni bir anonim oturum açıp (2) adımındaki `GET`'i yap —
veri **görünmemeli**. Bu, RLS'in çalıştığını doğrular.

## 7. Bildirimler (APNs)

Bildirim göndermek için Apple anahtarı gerekir. Yapılandırılmazsa tarama yine
çalışır, yalnızca gönderim adımı atlanır.

1. Apple Developer → **Keys** → yeni anahtar → *Apple Push Notifications service*
   → `.p8` dosyasını indir (bir kez indirilebilir).
2. Worker gizli değerlerine ekle:

```bash
wrangler secret put APNS_KEY        # .p8 dosyasının TÜM içeriği
wrangler secret put APNS_KEY_ID     # anahtarın Key ID'si
wrangler secret put APNS_TEAM_ID    # Apple Developer takım kimliği
```

3. `wrangler.toml` içinde `APNS_BUNDLE_ID` ve `APNS_PRODUCTION` ayarla
   (geliştirme derlemeleri için `false` = sandbox).

Elle tetikleyip doğrula:

```bash
curl -X POST $API/v1/push/scan -H "x-admin-token: <ADMIN_TOKEN>"
# {"checked":11,"notified":0}
```

İlk taramada `notified: 0` **beklenen davranıştır** — tarayıcı mevcut durumu
kaydeder, geçmiş bölümler için bildirim yağdırmaz.

> Xcode tarafında **Push Notifications** capability'si ve istemcide jeton
> kaydı hâlâ gerekir — bkz. [KALAN-ISLER.md](KALAN-ISLER.md).

## 8. Zamanlanmış görev (cron)

Feed taraması Cloudflare Cron Trigger ile 30 dakikada bir çalışır. Aralık
`wrangler.toml` içindedir:

```toml
[triggers]
crons = ["*/30 * * * *"]
```

Cron'u kapatmak için bu bölümü kaldırıp yeniden yayınla.

## 9. Özel alan adı (opsiyonel)

Cloudflare Dashboard → Workers & Pages → `aacp-api` → **Settings → Domains &
Routes → Add custom domain** → `api.ornek.com`.

Alan adı Cloudflare'de yönetiliyorsa sertifika otomatik gelir. Sonra `.env`
içindeki `APP_API_BASE_URL`'i güncelle.

## 10. İzleme ve bakım

**Canlı log:**
```bash
cd worker && npm run tail
```

**Yayın:**
```bash
npm run deploy              # üretim
npm run deploy:staging      # ayrı bir staging Worker'ı
```

**Veri:** Supabase Dashboard → Table Editor / SQL Editor. Otomatik yedekleme
Supabase tarafından yapılır (ücretsiz katmanda 7 gün).

**Telemetri sorgusu:**
```sql
select name, count(*) from analytics_events
where occurred_at > (extract(epoch from now() - interval '7 days') * 1000)
group by name order by count desc;
```

## 11. Yerel geliştirme

```bash
cd worker
cp .dev.vars.example .dev.vars   # gizli değerleri buraya yaz (depoya girmez)
npm run dev
```

Worker `http://localhost:8787` adresinde çalışır. Uygulamanın `.env`'inde
`APP_API_BASE_URL=http://localhost:8787` kullanabilirsin.

> **iOS uyarısı:** App Transport Security düz HTTP'yi engeller. Simülatörde
> `localhost` genelde sorunsuzdur; gerçek cihazda yayınlanmış (HTTPS) Worker
> adresini kullan.

## 12. Sorun giderme

| Belirti | Sebep / çözüm |
|---|---|
| `/health` → `supabase: false` | `SUPABASE_ANON_KEY` veya `SUPABASE_URL` eksik |
| `401 Jeton imzası geçersiz` | `SUPABASE_JWT_SECRET` yanlış (Settings → API → JWT Settings) |
| `403 Yönetim uçları kapalı` | `ADMIN_TOKEN` tanımlanmamış → `wrangler secret put ADMIN_TOKEN` |
| `Veritabanı hatası (401/403)` | Şema çalıştırılmamış ya da RLS politikaları eksik → §2 |
| Senkron boş dönüyor | Farklı kullanıcıyla bakıyorsun (RLS doğru çalışıyor) |
| Katalog boş | Yayınlanmamış → §4 (uygulama yine gömülü listeyle çalışır) |
| Uygulama sunucuyu görmüyor | `.env` sonrası **yeniden derlemedin** |
| Cron çalışmıyor | Ücretsiz planda cron destekleniyor; `npm run tail` ile logu izle |

---

## Maliyet

Her iki servisin ücretsiz katmanı bu uygulamanın erken ölçeği için yeterlidir:

- **Cloudflare Workers**: günde 100.000 istek, 10 ms CPU/istek, cron dahil.
- **Supabase**: 500 MB veritabanı, 50.000 aylık aktif kullanıcı (auth).

Aşıldığında ikisi de kullanım başına ölçeklenen ücretli plana geçer; kod
değişikliği gerekmez.
