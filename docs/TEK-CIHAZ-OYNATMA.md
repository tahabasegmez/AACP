# Tek Cihazda Oynatma ve Cihaz Aktarımı

Bir hesapta aynı anda **tek cihaz** çalar. Kullanıcı oynatmayı iki yönde de
taşıyabilir: başka cihazdaysa buraya alır, buradaysa seçtiği cihaza gönderir.

## Veri nerede durur

Belirleyici soru "bu veri ne kadar yaşar" — bkz. `worker/src/storage/resolveStore.ts`
doktrini.

| Veri | Yer | Yazma sıklığı | Neden |
|---|---|---|---|
| Cihaz listesi (ad, platform) | **Postgres** | oynatma başına 1 | Kullanıcıya gösterilir, hesapla birlikte silinir, kalıcı olmalı |
| Kim aktif · ne çalıyor · bekleyen komut | **Redis, TTL 120 sn** | tur başına, o da koşullu | Saniyeler içinde eskir, sorgulanmaz, kaybolması zararsız |

Oturum durumunu Postgres'te tutmak, her turda satır güncellemek demekti: her
yazım WAL ve ölü satır üretir, autovacuum sürekli çalışır. Yüz eşzamanlı
dinleyicide saniyede onlarca yazma — sırf "hâlâ ben çalıyorum" demek için.

**Cloudflare KV bu iş için kullanılamaz:** 60 saniyeye varan eventual
consistency, "kim çalıyor" sorusunu yanlış cevaplar. Redis yoksa KV'ye değil,
`playback_sessions` tablosuna düşülür.

### Atomiklik neden yok

Kural bir **kilit** değil **devralmadır**. Çakışma için tek bir insanın iki
cihazda aynı milisaniyede düğmeye basması gerekir; olsa bile bir sonraki tur
(≤5 sn) durumu düzeltir ve zarar "birkaç saniye iki cihaz da kendini aktif
sanar"dan ibarettir. Lua betiği, `WATCH/MULTI` ya da kısmi tekil indeks bu
yüzden **yok**: olmayan bir soruna karmaşıklık olurdu.

TTL'in ikinci faydası: cihaz çökerse, uçağa binerse ya da uygulama
öldürülürse kimse `release` çağırmaz. Takılı kalmış bir "aktif cihaz" diye bir
şey olmaz, iki dakikada kendiliğinden düşer.

## Şema

`worker/supabase/schema-07-playback-devices.sql` — **tek dosya**, tekrar
çalıştırmak güvenlidir ve daha eski bir sürümü çalıştırmış kurulumları
(plpgsql fonksiyonları, `active` sütunu, kısmi tekil indeks) temizler.

- `playback_devices` — kalıcı cihaz listesi. RLS ile kendi satırları.
- `playback_sessions` — yalnızca **Redis bağlı değilse** kullanılan yedek;
  kullanıcı başına tek satır, yani bir anahtar-değer deposunun taklidi.

## Worker

`worker/src/playback/PlaybackSessionStore.ts` — oturumun portu ve iki
uygulaması (Redis / Postgres). Rotalar hangisinin devrede olduğunu bilmez;
ileride kalıcı bağlantıya (Durable Object) geçilirse değişen tek yer burasıdır.

`worker/src/routes/playback.ts`

| Uç | İş | Maliyet |
|---|---|---|
| `POST /v1/playback/claim` | oturumu devral | 1 GET + 1 SET + 1 Postgres upsert |
| `POST /v1/playback/release` | oturumu bırak | 1 GET (+1 SET yalnızca aktifsek) |
| `POST /v1/playback/transfer` | oynatmayı başka cihaza gönder | 1 GET + 1 SET |
| `POST /v1/playback/poll` | tur: yayınla + komut al + liste | 1 GET (+1 SET yalnızca gerekirse) |
| `GET /v1/playback/devices` | cihaz listesi (salt okunur) | 1 GET |

Turda **yazma koşulludur**: komut tüketildiyse, konum yayınlandıysa ya da
"son görülme" bir dakikadan eskiyse. Turların çoğu tek okumadır.

Oturum anahtarı düştüğünde (TTL) cihaz listesi Postgres'ten yeniden kurulur —
kullanıcı "cihazlarım" ekranında boş liste görmemeli. Aktif cihaz ve yayın ise
bilinçli olarak kaybolur: iki dakikadır ses gelmiyorsa kimse çalmıyordur.

## İstemci

| Katman | Dosya |
|---|---|
| domain | `entities/PlaybackDevice.ts`, `entities/PlaybackCommand.ts`, `repositories/DeviceSessionRepository.ts` |
| data | `repositories/ApiDeviceSessionRepository.ts` |
| presentation | `features/player/useDeviceSession.ts`, `components/DevicesSheet.tsx`, `components/PlaybackElsewhereBar.tsx`, `PlaybackSessionBridge.tsx` |

Akış (`usePlaybackSessionGuard`):

1. Çalmaya başlayınca oturum **devralınır**.
2. Düzenli **tur**: "hâlâ bende mi" ve "bana komut var mı". Tazeleme için
   `claim` kullanılmaz — oynatmayı başka cihazdan geri çalardı.
3. Oturum kaybedilmişse oynatma **duraklatılır** ve çevrimdışı şeridiyle aynı
   bileşenden (`StatusBanner`) türeyen bir şerit gösterilir.
4. "Şunu çal" komutu geldiyse oynatma **burada başlar**.
5. Duraklatınca oturum **bırakılır**.

### Sıklıklar

| Ne | Sıklık | Neden |
|---|---|---|
| Tur (okuma), çalarken | 5 sn | Devralınca sesin burada devam etmesi kabul edilemez |
| Tur (okuma), boşta + önplanda | 10 sn | Beklenen tek şey "bu cihazda çal" komutu |
| Tur, boşta + arka planda | yok | Beklenen komut yok, pil harcamanın anlamı yok |
| Konum yayını (yazma) | 15 sn | Aradaki boşluğu yaş kapatır — aşağıya bak |

Misafir kullanıcıda tur **hiç atılmaz**: misafir her cihazda ayrı bir
kimliktir, kuralın uygulanacağı bir hesap yoktur.

**Maliyet:** 1 dinleme-saati ≈ 720 GET + ~240 SET ≈ 1000 Redis komutu, Postgres'e
yazma yok.

### Konum: yayınla seyrek, hesapla taze

Yayın 15 saniyede bir yapılır ama devralan cihaz doğru saniyeden başlar:
sunucu yayına **yaşını** (`ageMs`) ekler, istemci `positionSec + yaş × hız`
hesaplar (`commandPositionSec`). Hız da taşınır — 1.5× dinleyen birinin 10
saniyesi 15 saniyelik sestir.

Yaşı **sunucu** ölçer: damgayı gönderip istemciye çıkarttırmak, cihaz saatleri
kaymışsa yanlış saniyeden başlamak demekti.

Aktarılan komutta yaş **yoktur** ve ekstrapole edilmez: kaynak cihaz komutu
gönderirken zaten susmuştu, aradan geçen süre dinlenmiş sayılmaz.

## Cihaz paneli

Tam ekran player'daki cihaz düğmesi `DevicesSheet`'i açar:

- hesabın cihazları, "bu cihaz" ve "Şu an çalıyor" işaretleriyle,
- **başka bir cihaza dokununca oynatma oraya gönderilir**,
- oynatma başka cihazdaysa **"Oynatmayı buraya al"** — o cihazın bölümü,
  kaldığı saniyeden burada devam eder,
- iOS'ta ayrıca **ses çıkışı** (AirPlay/Bluetooth) satırı; bu ayrı bir
  kavramdır: hesabın hangi cihazda çaldığı değil, bu cihazın sesi nereye
  verdiğidir.

Aktarımda kaynak cihaz **anında** susar (sunucu onayı beklenmez); hedef komutu
kendi turunda alır. Aktarılan şey tek bir bölümdür, kaynak cihazın kuyruğu
değil: kullanıcı cihaz değiştirdi, kuyruğunu taşımadı.

## Sonraki adım

Ölçekte doğrusu **Durable Object + WebSocket**: yoklama tümüyle kalkar,
durdurma anlık olur. Ücretli Workers planı gerektirir. İstemci tarafı
`DeviceSessionRepository` portunun arkasında olduğu için o geçişte
değişmeyecek.
