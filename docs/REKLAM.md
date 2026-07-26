# Reklam Sistemi

Podcast dinlerken araya sesli reklam girmesini sağlayan sistem. Bu belge
tasarımı, yapılandırmayı ve nasıl genişletileceğini anlatır.

## 1. Bugünkü davranış

| Karar | Değer |
|---|---|
| Kaynak | **VAST** (IAB standardı, reklam sunucusundan) |
| Yerleşim | **Post-roll** (bölüm bittiğinde) |
| Atlanabilirlik | **Atlanamaz** (sarma ve hız kilitli) |
| Format | **Sesli reklam** |

**Varsayılan olarak KAPALIDIR.** Bir ad tag URL'i verilene kadar oynatma akışı
bugünküyle birebir aynı çalışır — reklam kodu devreye hiç girmez.

## 2. Nasıl açılır

[src/core/config/env.ts](../src/core/config/env.ts) içinde ilgili ortama
`adTagUrl` ekleyin:

```ts
production: {
  ...base,
  name: 'production',
  adTagUrl: 'https://ads.example.com/vast?pos={placement}&ep={episodeId}&cb={random}',
  adEveryNEpisodes: 1,
},
```

Ya da build zamanı değişkeniyle (kod değişmeden): `APP_AD_TAG_URL=...`

### Ad tag yer tutucuları

İstek anında doldurulur (URL-encode edilir):

| Yer tutucu | Değer |
|---|---|
| `{placement}` | `postroll` |
| `{episodeId}` | Çalınan bölümün kimliği |
| `{showId}` | Şovun kimliği |
| `{duration}` | Bölüm süresi (saniye) |
| `{timestamp}` | İstek zamanı (epoch ms) |
| `{random}` | Cache-busting için rastgele sayı |

## 3. Mimari

Reklam mantığı **tek bir yerde** toplanır: oynatıcıyı saran bir decorator.
Use case'ler, UI ve CarPlay hiçbir değişiklik görmez — hepsi aynı
`AudioPlayerService` portunu kullanmaya devam eder.

```
domain/
  entities/Ad.ts           → Ad, AdBreak, AdPlacement, AdTrackingEvent
  entities/adPolicy.ts     → NE ZAMAN reklam gösterilir (saf kurallar)
  entities/PlaybackState   → `ad?: AdPlaybackState` alanı
  repositories/AdRepository → reklam sağlama PORTU

data/
  mappers/vastMapper.ts        → VAST XML → domain (saf, test edilir)
  repositories/VastAdRepository → ad tag çağrısı + wrapper zinciri + tracking

infrastructure/
  audio/AdAwareAudioPlayer.ts  → DECORATOR: bölüm bitince reklam çalar

presentation/
  PlayerScreen                 → reklam bandı, kilitli kontroller
```

### Neden decorator?

`AdAwareAudioPlayer`, `AudioPlayerService` portunu implement eder ve gerçek
oynatıcıyı sarar:

```ts
const audioPlayer = isAdsEnabled(env)
  ? new AdAwareAudioPlayer(basePlayer, adRepository, logger, policy)
  : basePlayer;
```

Kazanç: reklam açılıp kapanması composition root'ta **tek satır**. Çağıran hiçbir
kod (use case, UI, CarPlay) reklamdan haberdar olmak zorunda değil.

### Akış (post-roll)

```
bölüm biter (status: 'ended')
   ↓
politika kontrolü (shouldRequestAd)  ── hayır ──▶ 'ended' yayınla (normal akış)
   ↓ evet
VAST isteği (wrapper zinciri çözülür)
   ↓ reklam yok ──▶ 'ended' yayınla
   ↓ reklam var
kesinti çalınır (pod ise sırayla)
  · state.ad dolu → UI bandı, seek/hız kilitli
  · impression/start/çeyrek/complete olayları bildirilir
  · "kaldığın yer" KAYDEDİLMEZ
   ↓
kesinti biter → state.ad temizlenir → 'ended' yayınlanır
```

**Kritik detay:** reklam çalarken `'ended'` durumu dışarı sızmaz. Aksi halde
kuyruk, reklam çalarken sonraki bölüme geçerdi.

## 4. Politika (ne zaman reklam?)

[adPolicy.ts](../src/domain/entities/adPolicy.ts) saf fonksiyonlardan oluşur —
oynatma tekniğinden bağımsız, kolayca test edilir ve değiştirilir.

```ts
export const DEFAULT_AD_POLICY: AdPolicyConfig = {
  enabled: false,              // ad tag verilince açılır
  placements: ['postroll'],
  everyNEpisodes: 1,           // her bölüm sonunda
  minIntervalMs: 5 * 60_000,   // iki reklam arası en az 5 dk
  minEpisodeDurationSec: 120,  // 2 dk'dan kısa bölümde reklam yok
};
```

`minIntervalMs` ve `minEpisodeDurationSec` kötü deneyime karşı korumadır: kısa
bölümler peş peşe dinlenirken reklam yağmaz.

## 5. Genişletme

### Mid-roll veya pre-roll eklemek

Altyapı hazır — `AdPlacement` üç değeri de tanıyor. Gerekenler:

1. Politikaya yerleşimi ekleyin: `placements: ['preroll', 'postroll']`
2. `AdAwareAudioPlayer`'da tetikleyiciyi yazın:
   - **Pre-roll**: `play()` içinde, bölümü çalmadan önce,
   - **Mid-roll**: ilerleme dinleyicisinde belirli saniyelerde (bölüm konumunu
     saklayıp reklam sonrası geri dönmek gerekir — post-roll'dan daha karmaşık).

### Atlanabilir reklam

1. `AdPlaybackState.skippable` zaten var; decorator'da `true` verin,
2. `seekTo`/`setRate` kilidini `skippable` durumuna bağlayın,
3. UI'da "Geç" butonu ekleyin ve `skip` izleme olayını bildirin
   (`tracking.skip` VAST'tan zaten okunuyor).

### Reklam sağlayıcısını değiştirmek

`AdRepository` portunu implement eden yeni bir sınıf yazıp composition root'ta
değiştirin. Domain, UI ve oynatıcı etkilenmez. VAST'a özgü her şey
`vastMapper` + `VastAdRepository` içinde kapalıdır.

### Görsel/companion reklam

`Ad.clickUrl` ve `advertiser` zaten taşınıyor. Görsel eklemek için `Ad`'e
`companionImageUrl` alanı ve mapper'a `<CompanionAds>` okuması eklenir; Player
bandı bunu gösterir.

## 6. Dayanıklılık ilkeleri

Bunlar bilinçli tercihlerdir; değiştirmeden önce sebebini bilin:

1. **Reklam alınamazsa hata DEĞİLDİR.** `VastAdRepository` her başarısızlıkta
   `ok(null)` döner ve oynatma reklamsız devam eder. Reklam sunucusu çökse bile
   uygulama çalışır.
2. **Reklam isteği 5 saniyede zaman aşımına uğrar.** Dinleyici reklam sunucusunu
   beklemez.
3. **Bozuk VAST atlanır.** Ayrıştırılamayan reklam "reklam yok" gibi ele alınır.
4. **İzleme (tracking) best-effort'tur.** Piksel istekleri beklenmez ve
   başarısızlıkları oynatmayı etkilemez.
5. **Reklam ilerlemesi kaydedilmez.** `PodcastProviders` içindeki köprü
   `state.ad` doluysa "kaldığın yer" yazmaz — aksi halde bölüm konumu bozulurdu.
6. **Wrapper zinciri 4 adımla sınırlıdır.** Sonsuz yönlendirme koruması.

## 7. Test etme

Birim testleri: VAST ayrıştırma, politika kuralları ve decorator davranışı
(28 test).

```bash
npm test -- vastMapper adPolicy AdAwareAudioPlayer
```

**Gerçek reklamla denemek için** Google'ın herkese açık VAST test etiketleri
kullanılabilir. Örnek (tek reklamlı yanıt):

```
https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=
```

> Bu örnek **video** reklam döndürür; ses dosyası olmadığından mapper `MediaFile`
> önceliğine göre ilk dosyaya düşer. Gerçek doğrulama için reklam sağlayıcınızın
> ses (audio) test etiketini kullanın.

## 8. Bilinen sınırlar

- **Yalnızca post-roll.** Mid-roll için §5'e bakın.
- **VAST Linear + MediaFile alt kümesi** destekleniyor: VPAID, VMAP ve
  companion görselleri işlenmez.
- **Ad pod sırası** `sequence` özniteliğine göredir; sunucu bunu vermezse
  yanıttaki sıra korunur.
- **Çevrimdışı bölümlerde** reklam istenir ama ağ yoksa sessizce atlanır.
