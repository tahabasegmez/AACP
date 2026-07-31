# Kullanıcı ve Hesap Sistemi

Uygulamanın kimlik modeli, verinin nerede yaşadığı ve senkronun nasıl çalıştığı.

## 1. Tek kullanıcı kavramı

**"Anonim kullanıcı" ve "hesaplı kullanıcı" ayrı varlıklar DEĞİLDİR.** Tek bir
`User` entity'si vardır; hesap bağlandığında aynı kayıt zenginleşir:

```
ilk açılış          →  User { id }                 (anonim)
hesap oluşturulur   →  User { id, email, ... }     (aynı id!)
```

Bunun sonucu kritiktir: **anonimken biriken veri hesaba geçerken taşınmaz,
çünkü zaten aynı kullanıcıya aittir.** Ayrı bir göç adımı, veri kopyalama ya da
"hesabına aktar" akışı yoktur.

Bu, Supabase Auth'un iki özelliğiyle sağlanır:
1. **Anonymous sign-in** — ilk açılışta kalıcı bir kullanıcı üretilir,
2. **User update** — kayıt sırasında aynı kullanıcıya e-posta/şifre eklenir.

Worker'daki `/v1/auth/register` ucu bunu uygular: istek oturumlu geldiyse ve
kullanıcı anonimse YENİ kullanıcı yaratılmaz, mevcut kayıt yükseltilir.

## 2. Katmanlar

| Katman | Dosya | Sorumluluk |
|---|---|---|
| domain | [User.ts](../src/domain/entities/User.ts) | Kullanıcı modeli, doğrulama kuralları |
| domain | [UserRepository.ts](../src/domain/repositories/UserRepository.ts) | Kimlik PORTU |
| data | [UserRepositoryImpl.ts](../src/data/repositories/UserRepositoryImpl.ts) | API çağrıları + yerel profil önbelleği |
| presentation | [useAccount.ts](../src/presentation/query/useAccount.ts) | Query/mutation hook'ları |
| presentation | [AuthSheet.tsx](../src/presentation/features/account/AuthSheet.tsx) | Giriş/kayıt paneli |
| worker | [routes/auth.ts](../worker/src/routes/auth.ts) | Supabase Auth proxy'si |
| worker | [auth.ts](../worker/src/auth.ts) | Jeton doğrulama (yerel, HS256) |

## 3. Hangi veri nerede yaşar?

> Sunucu tarafındaki ayrıntı (hangi tablo, PostgreSQL mi NoSQL mi) için bkz.
> [VERI-MIMARISI.md](VERI-MIMARISI.md).

| Veri | Yer | Sebep |
|---|---|---|
| Kaldığın yer (progress) | cihaz + **sunucu** | Cihazlar arası devam |
| Takip edilen şovlar | cihaz + **sunucu** | Kütüphane her cihazda aynı |
| Sonra dinle | cihaz + **sunucu** | Sistem listesi, senkronlanır |
| Kullanıcı listeleri | cihaz + **sunucu** | Playlist senkronu |
| Tercihler | cihaz + **sunucu** | Bkz. [TERCIHLER.md](TERCIHLER.md) — misafirde de hatırlanır |
| **İndirilen dosyalar** | **yalnızca cihaz** | Dosyalar cihaza özgü; sunucuya taşınmaz |
| Oturum jetonu | yalnızca cihaz | Güvenlik |
| Profil önbelleği | cihaz | Çevrimdışı açılışta ad/e-posta bilinsin |

İndirmelerin senkronlanmaması bilinçlidir: yerel dosya yolları cihaza (ve iOS'ta
kurulum container'ına) bağlıdır, başka cihazda anlamsızdır.

## 4. Senkron

Model: **delta + son-yazan-kazanır**. Koleksiyonlar:
`progress`, `follows`, `playlists`, `preferences`.

> **"Sonra dinle" ayrı bir koleksiyon DEĞİLDİR.** O, playlist sisteminin sistem
> listesidir (`SAVED_PLAYLIST_ID`) ve `playlists` içinde taşınır. Ayrı bir depo
> ve adaptör tutmak aynı veriyi iki kez senkronlamak ve kaynakların sessizce
> sapması demekti. Uygulama tarafında eski `SavedEpisodesRepository` portu
> korunur ([PlaylistBackedSavedEpisodes](../src/data/repositories/PlaylistBackedSavedEpisodes.ts))
> ama tek kaynağa yönlenir.

Playlist senkronu ([PlaylistSyncAdapter](../src/data/sync/PlaylistSyncAdapter.ts))
diğerlerinden farklıdır: her liste zaten kendi `updatedAt` damgasını taşır, bu
yüzden gölge meta haritası gerekmez. Silinen listeler için tombstone tutulur.

**Sistem listesi uzaktan silinemez** — bir cihazdaki hata tüm kaydedilenleri yok
etmesin diye adaptör bunu reddeder.

### 4.1 Kimlik değişiminde veri ne olur?

Cihazdaki veri bir kimliğe aittir. Kimlik değişince üç akış vardır:

| Durum | Ne olur | Neden |
|---|---|---|
| **Kayıt** (anonim → hesap) | `adoptLocalInto()` — veri hesaba taşınır | Sunucu aynı kullanıcıyı yükseltir; veri zaten bu kişiye ait |
| **Giriş** (başka hesaba) | Kullanıcıya **sorulur** | Cihazdaki veri BAŞKA bir kimliğe ait; sessizce birleştirmek de silmek de sürpriz olur |
| **Çıkış** | `clearLocalData()` | Hesabın verisi misafir kullanıcıya devredilmemeli |

Girişte iki seçenek sunulur:
- **Hesabıma aktar** (`adoptLocalInto`) — imleçler sıfırlanır, tüm yerel veri
  gönderilir, hesabın verisi indirilir. Çakışanlarda en yeni kazanır.
- **Hesabımdakiyle devam et** (`replaceWithRemote`) — yerel veri silinir,
  sunucudan temiz kopya iner.

**İndirilen dosyalara hiçbir akışta dokunulmaz** — cihaza özgüdürler ve hiçbir
hesaba ait değildirler; çevrimdışı dinleme bozulmamalıdır.

### 4.2 Çakışmalar nasıl görünür?

"Son yazan kazanır" politikasında bazı yerel değişiklikler daha yeni bir uzak
kayıt tarafından geçersiz kılınır. Bu sessizce olursa kullanıcı "değişikliğim
neden kayboldu?" der. Bu yüzden motor çakışan kayıtları sayar
([SyncStatus.conflictCount](../src/domain/entities/SyncStatus.ts)) ve Ayarlar'da
şu satır görünür:

> *"3 kayıt başka bir cihazda daha yeni olduğu için güncellendi."*

Ayarlar → Senkron ayrıca şunu gösterir: son senkron zamanı ("5 dakika önce"),
bekleyen değişiklik sayısı ve son hata.

## 5. Sunucusuz çalışma

`APP_API_BASE_URL` boşsa:
- hesap bölümü Ayarlar'da **görünmez**,
- senkron ve telemetri sessizce kapanır,
- uygulama tamamen yerel çalışır ve hiçbir akış kırılmaz.

Bu, kurulumun güvenli varsayılanıdır.

## 6. Uçlar

| Uç | Açıklama |
|---|---|
| `POST /v1/auth/device` | Anonim oturum (Supabase anonymous sign-in) |
| `POST /v1/auth/register` | Hesap oluştur (oturumlu gelirse anonim kullanıcıyı yükseltir) |
| `POST /v1/auth/login` | E-posta + şifre ile giriş |
| `POST /v1/auth/refresh` | Erişim jetonunu yeniler |
| `GET /v1/auth/me` | Oturumdaki kullanıcının profili |
| `POST /v1/auth/profile` | Görünen adı güncelle |
| `POST /v1/auth/reset-password` | Şifre sıfırlama e-postası |

### Güvenlik notları

- **Şifreleri biz saklamıyoruz.** Kimlik doğrulama Supabase Auth'ta yapılır;
  Worker yalnızca proxy'dir. Şifre özetleme, sızıntı koruması ve oran sınırlama
  platformun sorumluluğundadır.
- **Jetonlar yerelde doğrulanır** (HS256 + JWT secret). Her istekte Supabase'e
  sormak edge'in hız avantajını yok ederdi.
- **Yetki veritabanında zorunlu** (RLS). Worker'da bir hata olsa bile kullanıcı
  başkasının verisini okuyamaz.
- **Şifre sıfırlama yanıtı her durumda aynıdır** — hesabın var olup olmadığı
  sızmaz.
- `service_role` anahtarı yalnızca kullanıcıya ait olmayan işlerde kullanılır
  (katalog, feed tarama) ve asla uygulamaya gömülmez.

## 7. Jeton yenileme

Supabase erişim jetonları kısa ömürlüdür (varsayılan 1 saat). `ApiClient`
oturumu şöyle korur:

```
istek 401 alır
  └─ refreshToken varsa  → POST /v1/auth/refresh   (hesap korunur)
  └─ yoksa/başarısızsa   → POST /v1/auth/device    (anonime düşer)
```

Bu sıralama önemlidir: aksi halde jetonu eskiyen bir kullanıcı sessizce
misafire dönerdi.

## 8. Kalanlar

- **SSO** (Apple/Google ile giriş) — Supabase destekliyor, uç eklenmedi.
- **Oturum listesi / uzaktan çıkış** yok.
- Profil yalnızca görünen ad içerir; avatar yok.

> Şifre sıfırlama artık **var** (Supabase Auth e-posta gönderir); uygulamada
> arayüzü henüz bağlanmadı — uç hazır.
