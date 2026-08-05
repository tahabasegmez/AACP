# Tek Cihazda Oynatma

Bir hesapta aynı anda **tek cihaz** çalabilir. Kural veritabanında zorlanır;
istemci yalnızca devralır, bırakır ve sonucu gösterir.

## Veritabanı

`worker/supabase/schema-07-playback-devices.sql`

- `playback_devices` — hesabın cihazları (`id`, `name`, `platform`, `active`,
  `last_seen_at`).
- Kısmi benzersiz indeks (`where active`) — **aynı kullanıcıda birden fazla
  aktif cihaz veritabanı düzeyinde imkânsız**. Kuralı uygulama koduna
  bırakmak, iki cihazın aynı anda çalmaya başladığı yarışta iki aktif satır
  bırakırdı.
- `claim_playback(p_device_id, p_name, p_platform)` / `release_playback(p_device_id)`
  — `security definer` fonksiyonlar, `auth.uid()` ile çalışır. Devralma tek
  işlemde yapılır: önce diğerlerini pasifleştirip sonra kendini aktifleştirmek
  atomik olmazdı.

> Kurulum: bu dosyayı Supabase SQL editöründe bir kez çalıştır.

### Aktarım (şema 08)

`worker/supabase/schema-08-playback-transfer.sql`

- `playback_devices.pending_command jsonb` — hedef cihazın **gelen kutusu**.
  Cihazlar arasında doğrudan bir kanal yoktur (uygulama arka planda olabilir),
  komut sunucuda bekler ve hedef cihaz kendi turunda alır.
- `transfer_playback(p_to_device_id, p_command)` — hedefi aktif yapar ve komutu
  bırakır. Kaynağa ayrıca "dur" gönderilmez: kendi turunda oturumu kaybettiğini
  görüp duraklar, böylece durdurma kuralı tek yerde kalır.
- `poll_playback(p_device_id)` — tazele + gelen kutusunu boşalt + listeyi al.
  Komut okunduğunda silinir; satır `for update` ile kilitlenir, iki tur aynı
  komutu alamaz.

> **Uyarı:** `update … returning pending_command` kullanılamaz — RETURNING yeni
> (null) değeri döndürür, komut hiç görünmezdi.

### Çalan bölümün taşınması (şema 09)

`worker/supabase/schema-09-now-playing.sql`

- `playback_devices.now_playing jsonb` — **aktif cihaz her turda ne çaldığını
  yayınlar** (bölüm anlık görüntüsü + saniye). Biçim `pending_command` ile
  aynıdır: devralanın ihtiyacı ile aktarılan komutun ihtiyacı birebir aynı,
  iki ayrı biçim tanımlamak ikisinin sessizce ayrışması demekti.
- `claim_playback` artık `jsonb` döner: liste **+ devralınan cihazın çaldığı**.
  Devralan cihaz oradan devam eder — kendi yerel kaydından devam etmek, çoğu
  zaman başka bir bölümü başka bir saniyeden çalmaktı.
- `poll_playback(p_device_id, p_now_playing)` — yayını alır, aktif cihazın
  yayınını döner. `p_now_playing` null geldiğinde son yayın **korunur**:
  duraklamış bir cihazın yayınını silmek, devralanın "nereden devam edeceğim"
  bilgisini yok ederdi.

## Worker

`worker/src/routes/playback.ts`

| Uç | İş |
|---|---|
| `POST /v1/playback/claim` | oturumu bu cihaza al |
| `POST /v1/playback/release` | oturumu bırak |
| `POST /v1/playback/transfer` | oynatmayı başka cihaza gönder |
| `POST /v1/playback/poll` | cihazın turu: tazele + komut al + liste |
| `GET /v1/playback/devices` | hesabın cihazları (salt okunur) |

`poll` POST'tur çünkü gelen kutusunu **tüketir**; cihaz paneli gibi salt-okunur
yüzeyler `GET /devices` kullanır — panelin çağırması başka bir turun komutunu
yutardı.

## İstemci

| Katman | Dosya |
|---|---|
| domain | `entities/PlaybackDevice.ts`, `repositories/DeviceSessionRepository.ts` |
| data | `repositories/ApiDeviceSessionRepository.ts` |
| presentation | `features/player/useDeviceSession.ts`, `components/DevicesSheet.tsx`, `components/PlaybackElsewhereBar.tsx`, `PlaybackSessionBridge.tsx` |

Akış (`usePlaybackSessionGuard`):

1. Çalmaya başlayınca oturum **devralınır**.
2. Düzenli olarak **tur** atılır: "hâlâ bende mi" ve "bana komut var mı".
   Tazeleme için `claim` kullanılmaz — bu, oynatmayı başka cihazdan geri
   çalardı; tur yalnızca okur.
3. Oturum kaybedilmişse oynatma **duraklatılır** ve çevrimdışı şeridiyle aynı
   bileşenden (`StatusBanner`) türeyen bir şerit gösterilir: "<cihaz> üzerinde
   çalıyor · Buraya al".
4. "Şunu çal" komutu geldiyse oynatma **burada başlar**.
5. Duraklatınca oturum **bırakılır**.

### Tur sıklığı

| Durum | Sıklık | Neden |
|---|---|---|
| Çalarken | 5 sn | Devralınca sesin burada devam etmesi kabul edilemez. |
| Boşta + önplanda | 10 sn | Beklenen tek şey "bu cihazda çal" komutu. |
| Boşta + arka planda | tur yok | Beklenen bir komut yok; pil harcamanın anlamı olmazdı. |

Misafir kullanıcıda tur **hiç atılmaz**: misafir her cihazda ayrı bir
kimliktir, kuralın uygulanacağı bir hesap yoktur.

Gerçek zamanlı bir kanal (websocket/sessiz push) daha iyi olurdu; bugün ne push
yapılandırması ne de kalıcı bağlantı altyapısı var. Sıklıklar, o altyapı
geldiğinde tek yerden düşürülebilsin diye `useDeviceSession.ts` başında durur.

Ağ hatası oturum kaybı **sayılmaz**: çevrimdışı bir cihazda sesi susturmak,
kuralın korumaya çalıştığı şeyden daha zararlı olurdu.

Sunucu yapılandırılmamışsa (`apiBaseUrl` yok) kural tümüyle devre dışıdır —
yerel kurulumda hesap kavramı yoktur.

## Cihaz paneli

Tam ekran player'daki cihaz düğmesi `DevicesSheet`'i açar. Panelde:

- hesabın cihazları, "bu cihaz" ve "Şu an çalıyor" işaretleriyle,
- **başka bir cihaza dokununca oynatma oraya gönderilir** ("Buraya gönder"),
- oynatma başka cihazdaysa **"Oynatmayı buraya al"** — o cihazın çaldığı
  bölüm, kaldığı saniyeden burada devam eder,
- iOS'ta ayrıca **ses çıkışı** (AirPlay/Bluetooth) satırı — bu ayrı bir
  kavramdır: hesabın hangi cihazda çaldığı değil, bu cihazın sesi nereye
  verdiğidir.

Aktarımda kaynak cihaz **anında** susar (sunucu onayı beklenmez); hedef cihaz
komutu kendi turunda, birkaç saniye içinde alır. Beklemek, iki cihazda birden
ses çalması demekti.

Aktarılan şey tek bir bölümdür, kaynak cihazın kuyruğu değil: kullanıcı sıraya
eklediklerini taşımayı değil, cihaz değiştirmeyi istedi.
