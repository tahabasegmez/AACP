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

## Worker

`worker/src/routes/playback.ts`

| Uç | İş |
|---|---|
| `POST /v1/playback/claim` | oturumu bu cihaza al |
| `POST /v1/playback/release` | oturumu bırak |
| `GET /v1/playback/devices` | hesabın cihazları |

## İstemci

| Katman | Dosya |
|---|---|
| domain | `entities/PlaybackDevice.ts`, `repositories/DeviceSessionRepository.ts` |
| data | `repositories/ApiDeviceSessionRepository.ts` |
| presentation | `features/player/useDeviceSession.ts`, `components/DevicesSheet.tsx`, `components/PlaybackElsewhereBar.tsx`, `PlaybackSessionBridge.tsx` |

Akış (`usePlaybackSessionGuard`):

1. Çalmaya başlayınca oturum **devralınır**.
2. Çalarken 30 saniyede bir "hâlâ bende mi" diye **bakılır** — tazeleme için
   `claim` kullanmak, başka cihazdan oturumu geri çalardı.
3. Kaybedilmişse oynatma **duraklatılır** ve çevrimdışı şeridiyle aynı
   bileşenden (`StatusBanner`) türeyen bir şerit gösterilir: "<cihaz> üzerinde
   çalıyor · Buraya al".
4. Duraklatınca oturum **bırakılır**.

Ağ hatası oturum kaybı **sayılmaz**: çevrimdışı bir cihazda sesi susturmak,
kuralın korumaya çalıştığı şeyden daha zararlı olurdu.

Sunucu yapılandırılmamışsa (`apiBaseUrl` yok) kural tümüyle devre dışıdır —
yerel kurulumda hesap kavramı yoktur.

## Cihaz paneli

Tam ekran player'daki cihaz düğmesi `DevicesSheet`'i açar. Panelde:

- hesabın cihazları, "bu cihaz" ve "Şu an çalıyor" işaretleriyle,
- oynatma başka cihazdaysa **"Oynatmayı buraya al"**,
- iOS'ta ayrıca **ses çıkışı** (AirPlay/Bluetooth) satırı.

Başka bir cihaza oynatma **gönderilemez**: bunun için cihazlar arası gerçek
zamanlı bir kanal gerekirdi; panel yapamadığı bir şeyi vaat etmez.
