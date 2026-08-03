# Backend Mimarisi

AACP'nin sunucu tarafı iki yönetilen serviste çalışır:

| Katman | Servis | Kod |
|---|---|---|
| API | Cloudflare Workers | [worker/](../worker/) |
| Veri | Supabase Postgres | [worker/supabase/schema.sql](../worker/supabase/schema.sql) |
| Kimlik | Supabase Auth | Worker üzerinden proxy'lenir |

Kurulum adım adım: [CLOUDFLARE-SUPABASE-KURULUM.md](CLOUDFLARE-SUPABASE-KURULUM.md) ·
Kullanıcı modeli: [KULLANICI-VE-HESAP.md](KULLANICI-VE-HESAP.md) ·
Yarım kalanlar: [KALAN-ISLER.md](KALAN-ISLER.md)

## 0. Değişmez tasarım kararları

Bunlar bilinçli tercihlerdir; değiştirmeden önce sebebini bilin:

1. **Uygulama YALNIZCA Worker'ı tanır.** Supabase anahtarları uygulamaya
   gömülmez, Supabase SDK'sı istemcide bulunmaz. Kimlik ya da veri sağlayıcısı
   değişirse uygulama kodu etkilenmez — yalnızca Worker güncellenir.

2. **Yetkilendirme veritabanında zorunlu kılınır.** Kullanıcı verisine erişim
   daima kullanıcının kendi jetonuyla yapılır ve Postgres RLS devreye girer.
   Worker'da bir hata olsa bile bir kullanıcı başkasının satırlarını okuyamaz.
   `service_role` anahtarı yalnızca kullanıcıya ait olmayan işlerde (katalog,
   feed tarama) kullanılır.

3. **Çalışma zamanı bağımlılığı yok.** Worker, Supabase'e ve APNs'e doğrudan
   `fetch` ile gider; router ~120 satırlık kendi kodumuzdur. Bundle küçük kalır,
   soğuk başlatma hızlıdır, tedarik zinciri yüzeyi dardır.

4. **Uygulama sunucusuz da çalışır.** `APP_API_BASE_URL` boşsa senkron, hesap ve
   telemetri sessizce kapanır; hiçbir akış kırılmaz. Bu güvenlik ağını bozmayın.

5. **API sürümlü.** Tüm uçlar `/v1/...`. Kırıcı değişiklik gerekirse `/v2` yan
   yana yaşar, eski istemciler çalışmaya devam eder.

## 1. Uçlar

| Uç | Kimlik | Açıklama |
|---|---|---|
| `GET /health` | — | Sağlık + yapılandırma durumu |
| `POST /v1/auth/device` | — | Anonim oturum (Supabase anonymous sign-in) |
| `POST /v1/auth/register` | opsiyonel | Hesap oluştur; oturumlu gelirse anonim kullanıcıyı **yükseltir** |
| `POST /v1/auth/login` | — | E-posta + şifre |
| `POST /v1/auth/refresh` | — | Erişim jetonunu yeniler |
| `GET /v1/auth/me` | zorunlu | Profil |
| `POST /v1/auth/profile` | zorunlu | Görünen adı güncelle |
| `POST /v1/auth/reset-password` | — | Şifre sıfırlama e-postası |
| `GET /v1/sync/:collection` | zorunlu | Delta çekme (`?since=`) |
| `POST /v1/sync/:collection` | zorunlu | Yerel değişiklikleri gönder |
| `POST /v1/auth/avatar` | zorunlu | Profil fotoğrafı yükle |
| `GET /v1/catalog` | — | Şov listesi (en yeni bölüm üstte) |
| `GET /v1/catalog/shows/:slug/episodes` | — | Şovun bölümleri |
| `POST /v1/catalog/import` | admin | Şov bilgisini RSS'ten aktar |
| `POST /v1/catalog/shows` | admin | Şov bilgisini elle ver (istisna) |
| `DELETE /v1/catalog/shows/:slug` | admin | Yayından kaldır |
| `POST /v1/analytics` | opsiyonel | Telemetri (toplu) |
| `POST /v1/push/register` | zorunlu | Cihaz jetonu kaydı |
| `POST /v1/push/unregister` | zorunlu | Jeton sil |
| `POST /v1/push/scan` | admin | Feed taraması; `{"backfill":true}` ile tüm arşiv |

Koleksiyonlar: `progress`, `follows`, `saved`, `playlists`, `preferences`.

> Barındırıcıya özel bir API (ör. Transistor) YOKTUR: şov ve bölüm verisi
> RSS'ten okunur. RSS her sağlayıcıda çalışan ortak arayüzdür; barındırıcı
> değiştiğinde tek değişen şey feed adresidir.

## 2. Kimlik akışı

```
uygulama ilk açılış
   └─ POST /v1/auth/device      → Supabase anonymous sign-in
                                  { token, refreshToken, user }

kullanıcı hesap oluşturur
   └─ POST /v1/auth/register    → mevcut anonim kullanıcı YÜKSELTİLİR
      (Authorization ile)          (aynı user id → veri korunur)

jeton süresi dolar
   └─ POST /v1/auth/refresh     → yeni erişim jetonu
```

Worker, gelen jetonu **yerelde** doğrular (HS256 + JWT secret). Her istekte
Supabase'e sormak edge'in hız avantajını yok ederdi.

## 3. Senkron

Model: **delta + son-yazan-kazanır**.

Çakışma çözümü veritabanı trigger'ında yapılır (`sync_records_keep_newest`):
gelen kayıt yalnızca `updated_at` sunucudakinden büyükse yazılır. Bunu SQL
tarafında yapmak "oku-karşılaştır-yaz" yarışını ortadan kaldırır — iki cihaz
aynı anda yazarsa veri kaybı olmaz.

Silmeler tombstone olarak taşınır (`deleted = true`); aksi halde bir cihazdaki
silme diğerine ulaşmaz ve kayıt geri gelirdi.

## 4. Zamanlanmış işler

`FeedWatcher` Cloudflare Cron Trigger ile 30 dakikada bir çalışır: takip edilen
şovların feed'lerini tarar, yeni bölüm bulursa takipçilere APNs bildirimi
gönderir. İlk taramada bildirim gönderilmez (yalnızca durum kaydedilir).

## 5. Yerel geliştirme

```bash
cd worker
cp .dev.vars.example .dev.vars   # gizli değerler (git'e girmez)
npm run dev                      # http://localhost:8787
npm run ci                       # tip kontrolü + testler
```

## 6. Neden bu yığın?

Önceki sürüm kendi sunucumuzda (Node + SQLite + Docker) çalışıyordu. Yönetilen
servislere geçişin sebepleri:

- **Bakım yok**: işletim sistemi güncellemesi, disk yedeği, sertifika yenileme
  yok.
- **Coğrafi yakınlık**: Workers isteği kullanıcıya en yakın uçta karşılar.
- **Dayanıklılık**: tek makinenin arızası servisi düşürmez.
- **Ölçek**: ücretsiz katman erken ölçek için yeterli, sonrası kullanım başına.

Karşılığında Postgres'e (SQLite yerine) ve platform sınırlarına bağlıyız; ancak
`Supabase` sınıfı ve router kendi kodumuz olduğu için taşınabilirlik korunur.
