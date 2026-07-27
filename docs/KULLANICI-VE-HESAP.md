# Kullanıcı ve Hesap Sistemi

Uygulamanın kimlik modeli, verinin nerede yaşadığı ve senkronun nasıl çalıştığı.

## 1. Tek kullanıcı kavramı

**"Anonim kullanıcı" ve "hesaplı kullanıcı" ayrı varlıklar DEĞİLDİR.** Tek bir
`User` entity'si vardır; hesap bağlandığında aynı kayıt zenginleşir:

```
ilk açılış          →  User { id, deviceId }                (anonim)
hesap oluşturulur   →  User { id, deviceId, email, ... }    (aynı id!)
```

Bunun sonucu kritiktir: **anonimken biriken veri hesaba geçerken taşınmaz,
çünkü zaten aynı kullanıcıya aittir.** Ayrı bir göç adımı, veri kopyalama ya da
"hesabına aktar" akışı yoktur.

Sunucuda `AuthService.register()` bunu şöyle uygular: istek oturumlu geldiyse ve
o kullanıcının e-postası yoksa YENİ kullanıcı yaratılmaz, mevcut kayıt
yükseltilir.

## 2. Katmanlar

| Katman | Dosya | Sorumluluk |
|---|---|---|
| domain | [User.ts](../src/domain/entities/User.ts) | Kullanıcı modeli, doğrulama kuralları |
| domain | [UserRepository.ts](../src/domain/repositories/UserRepository.ts) | Kimlik PORTU |
| data | [UserRepositoryImpl.ts](../src/data/repositories/UserRepositoryImpl.ts) | API çağrıları + yerel profil önbelleği |
| presentation | [useAccount.ts](../src/presentation/query/useAccount.ts) | Query/mutation hook'ları |
| presentation | [AuthSheet.tsx](../src/presentation/features/account/AuthSheet.tsx) | Giriş/kayıt paneli |
| server | [AuthService.ts](../server/src/modules/auth/AuthService.ts) | Cihaz + e-posta kimliği |

## 3. Hangi veri nerede yaşar?

| Veri | Yer | Sebep |
|---|---|---|
| Kaldığın yer (progress) | cihaz + **sunucu** | Cihazlar arası devam |
| Takip edilen şovlar | cihaz + **sunucu** | Kütüphane her cihazda aynı |
| Sonra dinle | cihaz + **sunucu** | Sistem listesi, senkronlanır |
| Kullanıcı listeleri | cihaz + **sunucu** | Playlist senkronu |
| **İndirilen dosyalar** | **yalnızca cihaz** | Dosyalar cihaza özgü; sunucuya taşınmaz |
| Oturum jetonu | yalnızca cihaz | Güvenlik |
| Profil önbelleği | cihaz | Çevrimdışı açılışta ad/e-posta bilinsin |

İndirmelerin senkronlanmaması bilinçlidir: yerel dosya yolları cihaza (ve iOS'ta
kurulum container'ına) bağlıdır, başka cihazda anlamsızdır.

## 4. Senkron

Model: **delta + son-yazan-kazanır**. Koleksiyonlar:
`progress`, `follows`, `saved`, `playlists`.

Playlist senkronu ([PlaylistSyncAdapter](../src/data/sync/PlaylistSyncAdapter.ts))
diğerlerinden farklıdır: her liste zaten kendi `updatedAt` damgasını taşır, bu
yüzden gölge meta haritası gerekmez. Silinen listeler için tombstone tutulur.

**Sistem listesi ("Sonra dinle") uzaktan silinemez** — bir cihazdaki hata tüm
kaydedilenleri yok etmesin diye adaptör bunu reddeder.

## 5. Sunucusuz çalışma

`APP_API_BASE_URL` boşsa:
- hesap bölümü Ayarlar'da **görünmez**,
- senkron ve telemetri sessizce kapanır,
- uygulama tamamen yerel çalışır ve hiçbir akış kırılmaz.

Bu, kurulumun güvenli varsayılanıdır.

## 6. Uçlar (server)

| Uç | Açıklama |
|---|---|
| `POST /v1/auth/device` | Cihaz kimliğiyle anonim oturum |
| `POST /v1/auth/register` | Hesap oluştur (oturumlu gelirse anonim kullanıcıyı yükseltir) |
| `POST /v1/auth/login` | E-posta + şifre ile giriş |
| `GET /v1/auth/me` | Oturumdaki kullanıcının profili |
| `POST /v1/auth/profile` | Görünen adı güncelle |

### Güvenlik notları

- Şifreler **scrypt** ile özetlenir (Node çekirdeği; bcrypt/argon2 native
  derleme gerektirdiği için ARM kurulumunu zorlaştırırdı).
- Şifre karşılaştırması sabit zamanlıdır (`timingSafeEqual`).
- "Kullanıcı yok" ve "şifre yanlış" **aynı** hata mesajını döner — hangi
  e-postaların kayıtlı olduğu sızmaz.
- E-posta benzersizliği veritabanı indeksiyle güvence altındadır (NULL'lar
  serbest: anonim kullanıcılar).

## 7. Şema göçü

`users` tablosuna `email`, `password_hash`, `display_name` sütunları eklendi.
Çalışan bir kurulumda `CREATE TABLE IF NOT EXISTS` bu sütunları eklemeyeceği
için [SqliteStore.migrate()](../server/src/storage/SqliteStore.ts) eksik
sütunları tespit edip ekler. Yeni bir sütun eklemek = o dizide bir satır.

## 8. Kalanlar

- **Şifre sıfırlama** yok (e-posta gönderimi gerekir).
- **SSO** (Apple/Google ile giriş) yok.
- **Oturum listesi / uzaktan çıkış** yok.
- Profil yalnızca görünen ad içerir; avatar yok.
