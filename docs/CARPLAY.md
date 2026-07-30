# CarPlay

Uygulamanın araç içi yüzeyi. Telefondaki arayüzden bağımsızdır ama **aynı
domain use case'lerini** kullanır: oynatma, kaldığın yer, listeler ve
indirmeler tek yerde yaşar.

## 1. Ekran yapısı

Kök dört sekmedir (`TabBarTemplate`). Her sekme başlıklı gruplar ve kapaklı
satırlardan oluşur.

| Sekme | İçerik | Neden |
|---|---|---|
| **Ana Sayfa** (`house.fill`) | "Dinlemeye devam" girişi + "Podcast'ler" | Araçtaki iki temel ihtiyaç: kaldığın yer ve katalog |
| **Kitaplığın** (`books.vertical.fill`) | "Listelerim" ("Sonra dinle" dahil) | Kullanıcının kendi seçkisi |
| **İndirilenler** (`arrow.down.circle.fill`) | "Çevrimdışı dinle" | Araçta şebeke kopar; bunlar her zaman çalar |
| **Şimdi çalan** (`play.circle.fill`) | "Çalıyor" + "Sıradakiler" | Ne çalıyor, sırada ne var |

**"Dinlemeye devam" bir liste gibi davranır:** kökte tek satırdır, dokununca
bölümleri açılır. Kök ekranın kısa kalması, sürüş sırasında uzun bir rafta
gezinmekten güvenlidir. Açılan listede toplam süre değil **kalan süre** yazar.

Boş gruplar hiç gösterilmez; sekme tümüyle boşsa açıklayıcı bir boş görünüm
çıkar (`emptyViewTitleVariants`).

Bir bölüme dokunmak **kaldığı yerden** çalar ve Now Playing ekranını açar. Zaten
çalan bölüme dokunmak onu BAŞTAN başlatmaz, yalnızca oynatıcıyı açar — aynı
bölüm birçok listede görünür ve hangisinden dokunulursa dokunulsun dinlenen yer
kaybolmamalı. Aynı kural telefonda da geçerlidir (`usePlayEpisode`).

Alt seviye listeler **önce kapaksız açılır**, kapaklar hazır olunca yerinde
güncellenir: dokunuşla ekranın gelmesi arasındaki sessiz bekleme böyle kalkar.
Ağ gerektiren adımlarda (şov bölümleri) CarPlay satırda kendi yükleniyor
göstergesini çizer — seçim geri çağrısı beklediğimiz promise'i döndürdüğü sürece.

> **Sekme çubuğunun görünümü uygulamanın kontrolünde DEĞİLDİR.** Konum, hizalama
> ve stil CarPlay tarafından çizilir; uygulama yalnızca sekmelerin **başlığını
> ve SF Symbol simgesini** verir. Aynı sebeple Liquid Glass gibi sistem
> tasarımlarına geçiş de kendiliğinden olur: şablonları iOS çizdiği için
> uygulamada yapılacak bir "tasarım göçü" yoktur. Bize düşen sistem şablonları
> ve sistem simgeleri kullanmaktır — arayüzde özel çizim yoktur.

### Satır index'i tuzağı

CarPlay'in seçim olayı **düz bir index** verir: ikinci rafın ilk satırı,
birinci rafın öğe sayısından devam eder. Bu yüzden bölümler ve satır
davranışları tek yerden, birlikte üretilir:
[`buildList`](../src/carplay/templates/sections.ts). Saf bir fonksiyondur ve
ayrı test edilir; şablonlar ile davranışların ayrı alanlarda tutulması index
kaymasına açıktı.

## 2. Now Playing

İki parça vardır ve ayrımı bilinçlidir:

1. **"Şimdi çalan" sekmesi (bizim)** — çalan bölüm ve kuyruğun devamı. İçeriği
   uygulamanın kendi durumundan (`PlaybackQueueService` + çalan bölüm kimliği)
   gelir, dolayısıyla her zaman günceldir ve biz biçimlendiririz.
2. **Sistem Now Playing ekranı (iOS'un)** — taşıma kontrolleri. İçeriğini
   (başlık, sanatçı, kapak, süre) iOS `MPNowPlayingInfoCenter`'dan kendisi
   doldurur; uygulama oraya yalnızca track meta verisini yazar
   (`episodeToTrack`). Kilit ekranındaki kartla aynı kaynaktır.

**Şimdi çalan sekmesine dokunmak doğrudan sistem ekranını açar** (bir şey
çalıyorsa) — sürücü ikinci kez dokunmak zorunda kalmasın. Geri dönüldüğünde
sekmenin listesi görünür; "Çalıyor" satırı da ekranı yeniden açar.

Sistem ekranına eklenenler:

| Öğe | Nereden gelir |
|---|---|
| Oynat/duraklat, **seek çubuğu** | Sistem (track-player `MPNowPlayingInfoCenter`'ı besler) |
| **Sonraki / önceki bölüm** | `Capability.SkipToNext/Previous` → uygulamanın kuyruğu |
| **Sıradakiler** | `upNextButton` → kuyruk listesi, dokununca o bölüme atlar |
| **Şov adı** | `albumArtistButton` → o şovun bölümleri (Spotify davranışı) |
| **Oynatma hızı** | `playback` düğmesi (1 → 1.25 → 1.5 → 2) |

Apple, Now Playing'e en fazla **5 özel düğme** koymaya izin verir; yalnızca hız
düğmesi kullanılır. "Sonra dinle'ye ekle" (+) bilinçli olarak yoktur: sürüş
sırasında listeleme değil dinleme yapılır.

**Sarma tuşları (15/30 sn) kapalıdır.** iOS kartta hem sarma hem bölüm değiştirme
tuşlarını birden göstermez; araçta bölüm değiştirmek daha sık gerekir, sarma
zaten sürgüyle yapılabilir. Bu bir uygulama geneli ayardır
(`TrackPlayerAudioService`), dolayısıyla **kilit ekranını da** aynı şekilde
etkiler.

> **Hız etiketi (`0×`) sistemindir.** CarPlay'in hız düğmesinin üstünde yazan
> değeri iOS `MPNowPlayingInfoPropertyPlaybackRate`'ten okur; oraya JS'ten
> yazılamaz. Bu yüzden seçilen hız "Şimdi çalan" sekmesinin başlığında
> gösterilir (`Çalıyor · 1.5×`) — geri bildirim kendi yüzeyimizde verilir.

### Paylaşılan şablon (çökme tuzağı)

`CPNowPlayingTemplate` bir **singleton**'dır — `react-native-carplay` her
`new NowPlayingTemplate(...)` çağrısında aynı native örneği yeniden yapılandırır.
Bundan iki kural doğar:

1. **Şablon bir kez kurulur.** Her oynatmada yeniden yaratmak, her seferinde bir
   olay dinleyicisi daha bağlamak olurdu. Bu yüzden düğme davranışları
   dokunulduğu anda güncel duruma bakar, şablona gömülmez.
2. **Aynı örnek yığına iki kez eklenemez** — iOS istisna fırlatır ve uygulama
   ÇÖKER. Bu yüzden açılmadan önce şablonun nerede olduğuna bakılır:

   | Durum | Yapılan |
   |---|---|
   | Ekranda | Hiçbir şey |
   | Yığında ama ekranda değil (üstüne liste itilmiş) | `popToTemplate` ile ona dönülür |
   | Yığında değil | `pushTemplate` |

   Durum şablonun kendi `didAppear`/`didDisappear` olaylarından izlenir. Tek
   belirsizlik "ekrandan kayboldu" anıdır: üstüne biz bir liste ittiysek şablon
   yığında kalır, kullanıcı geri döndüyse kalmaz — ayrımı `pushedOverNowPlaying`
   yapar.

   > Körlemesine `popToRootTemplate` çağrılmaz: kökteyken CarPlay bunu
   > *"No templates were available to be popped"* hatasıyla bildirir.

`enableNowPlaying(true)` de bağlantı başında bir kez çağrılır (her oynatmada
değil), bağlantı koptuğunda kapatılır.

### Oynatma oturumu tek yerde yaşar

"Ne çalıyor ve sırada ne var" TEK yerde tutulur:
[`PlaybackSessionService`](../src/domain/services/PlaybackSessionService.ts).
CarPlay kendi kopyasını tutmaz; bir listeden çalmaya başlayınca bu port
üzerinden bağlamı kurar, "Sıradakiler" de aynı porttan okur.

`setContext` kuyruğu ve çalan bölümü **birlikte** alır. Bu bilinçlidir: ikisi
ayrı ayrı ayarlanabildiği sürece biri unutulabiliyor — nitekim CarPlay yalnızca
kuyruğu kurmuş, telefondaki kapak ve başlık eski bölümde kalmıştı.

```
Telefon (usePlaybackController)  ─┐
                                  ├─→ setPlaybackSession()  ← tek nokta
CarPlay (PlaybackSessionAdapter) ─┘        ├─ kuyruk
                                           └─ çalan bölüm
```

Port domain'de durur, somut uygulama
[PlaybackSessionAdapter](../src/app/carplay/PlaybackSessionAdapter.ts) ile
composition root'ta bağlanır — `@carplay` presentation'ı tanımaz.

Bağlam **her** oynatmada verilir: "Dinlemeye devam"dan çalmak bile bağlam olarak
o listeyi bırakır. Aksi halde tek bölümlük kuyruk kalır ve "Sıradakiler" boş
görünürdü.

### Oynatma kartının içeriği

Sistem Now Playing ekranını iOS `MPNowPlayingInfoCenter`'dan doldurur; oraya
yazan tek yer [`episodeToTrack`](../src/infrastructure/audio/playbackMapping.ts).
Kartta yalnızca bölüm başlığının görünmemesi için şov adı `artist` ve `album`
alanlarına da yazılır.

Şov adı bölümle birlikte taşınır (`Episode.showTitle`): kart bölümü tek başına
alır, orada katalog araması yapmak gerekmemeli. İndirme ve "kaldığın yer"
kayıtları yalnızca şov kimliği tuttuğu için CarPlay adı katalogdan tamamlar
(`withShow`).

> **Arka plan rengi:** CarPlay'de template arka planı uygulamanın kontrolünde
> DEĞİLDİR. Now Playing ekranının rengini iOS, albüm kapağından kendisi türetir
> — telefondaki `CoverGradient` etkisinin karşılığı sistemde zaten vardır.
> Bizim yaptığımız, kapak görsellerini doğru biçimde sağlamaktır.

## 3. Kapak görselleri

Kapaklar `ListItem.**imgUrl**` alanıyla ve **yalnızca yerel dosya adresiyle**
verilir. İkisi de zorunlu; sebebi native tarafta:

`image` alanı RN'in `RCTConvert UIImage` yoluna girer ve o yol bu iş için
kullanılamaz:

| Verilen | Sonuç |
|---|---|
| `https://…` | *"Only local files or data URIs are supported"* — kapak çizilmez, **ana iş parçacığında** hata üretir |
| `file:///…` | `RCTImageFromLocalBundleAssetURL` içinde `URLByAppendingPathComponent:nil` → **NSInvalidArgumentException, Thread 1 çökmesi** |

İkinci satır bir RN hatasıdır: `file:///…` adresinde `URL.host` **nil**'dir,
`[nil stringByAppendingString:]` nil döner ve `URLByAppendingPathComponent:`
nil argümanla çağrılır.

`imgUrl` ise `RCTConvert`'e hiç uğramaz, görseli doğrudan okur. Ona **yerel**
dosya verildiği için okuma da diskten olur — kütüphanenin varsayılan
davranışındaki gibi ana iş parçacığında ağ beklenmez.

Bu yüzden kapaklar önce indirilir:

```
Episode.imageUrl (https://…)
   └─ ArtworkCache portu            ← core/ports
        └─ BlobUtilArtworkCache     ← infrastructure (önbellek dizini)
             └─ file:///…/aacp_artwork/<hash>.jpg
                  └─ CarPlay satırı
```

- Görseller **önbellek dizinine** yazılır: kullanıcı verisi değildir, iOS yer
  sıkıştığında temizleyebilir, kaybolursa yeniden inilir.
- Aynı adres için eşzamanlı istekler tek indirmede birleşir.
- İndirilemeyen kapak sessizce **düşer**; satır kapaksız görünür, liste çalışır
  (`withLocalImages`).
- Adres → dosya eşlemesi saf fonksiyonlardadır (`imageUrls`, `withLocalImages`)
  ve ayrı test edilir.
- Yol `encodeURI` ile kodlanır: kaçırılmamış bir karakterde `NSURL` nil döner
  ve kapak sessizce kaybolurdu.

> Kütüphanenin tip tanımında `ListItem.imgUrl?: null` yazar — native taraf
> orada metin okuduğu için tanım hatalıdır. Dönüşüm tek bir yerde
> (`asListSections`) ve gerekçesiyle yapılır.

Çalan bölüm `isPlaying` ile işaretlenir; oynatma değiştikçe sekmeler tazelenir
(`watchPlayback`) — böylece hem işaret hem "Dinlemeye devam" rafı güncel kalır.
Kaynaklar yereldir (katalog hariç), tazeleme ağa çıkmaz.

> **Bilinen tuzak — "object is not a function":** `react-native-carplay` 2.3.0,
> RN'in `resolveAssetSource` modülünü CommonJS sanıp doğrudan çağırıyor. RN
> 0.86'da bu modül `export default` kullandığı için `require()` bir nesne
> döndürür ve **görselli her liste** çöker. `metro.config.js` isteği
> [shims/resolveAssetSource.js](../shims/resolveAssetSource.js) sarmalayıcısına
> yönlendirerek düzeltir. Kütüphane sürümü yükseltilirse bu yönlendirmenin hâlâ
> gerekip gerekmediği kontrol edilmeli.
>
> Metro yapılandırması **önbelleğe alınır**: değişiklikten sonra paketleyici
> `npx react-native start --reset-cache` ile başlatılmalı, yoksa eski çözümleme
> kullanılmaya devam eder.

Yine de kapak çizimi patlarsa liste BOŞ kalmaz: `TabList.update` hatayı loglar
ve aynı içeriği kapaksız gösterir (`withoutImages`). Araçta boş ekran
göstermektense kapaksız liste göstermek yeğdir.

## 3.1 Hata dayanıklılığı

CarPlay geri çağrıları senkrondur; içeriden fırlayan bir hata "unhandled
rejection" olarak düşer ve sebebi kaybolur. Bu yüzden:

- Tüm ateşle-unut tazelemeler tek kapıdan geçer (`refresh()`) ve her zaman loglanır.
- Düğme geri çağrıları `run()` üzerinden çalışır; hata yutulmaz.
- Her kaynak ayrı okunur (`read()`): biri hata verse bile diğer sekmeler dolar.
- Satır davranışları `try/catch` içinde çalışır; hangi listede patladığı loglanır.

### Tazeleme turları birleştirilir

Sekme değiştirme, oynatma değişimi ve "Sonra dinle"ye ekleme aynı anda tazeleme
isteyebilir. Süren bir tur varsa yenisi başlatılmaz; yalnızca "bitince bir kez
daha" işaretlenir (`refreshQueued`). Araçta her dokunuşta üst üste depolama
turları birikmesin.

## 3.2 Aynı bölümün iki kez görünmesi

İki ayrı korumayla engellenir:

- **Kaynakta:** [GetResumeList](../src/domain/usecases/player/GetResumeList.ts)
  bölüm başına tek kayıt döndürür (en yeni damgalı kazanır) ve
  [ProgressSyncAdapter](../src/data/sync/ProgressSyncAdapter.ts) uzak kaydı
  daima kaydın kendi bölüm kimliğiyle anahtarlar. Ayıklama use case'te yapılır;
  böylece telefon ve CarPlay aynı garantiyi paylaşır.
- **Ekranda:** "Dinlemeye devam" rafındaki bir bölüm "Sonra dinle" rafından
  düşürülür — aynı ekranda iki kez görünmez, üstteki raf kazanır.

## 4. Sesli komut (Siri)

Domain tarafı hazırdır: [ResolveVoiceQuery](../src/domain/usecases/voice/ResolveVoiceQuery.ts)
bir metni çalınabilir bir bölüme çevirir.

Öncelik sırası niyeti yansıtır:
1. **Şov adı** eşleşmesi → o şovun en son bölümü ("Bir bakışta çal"),
2. **Bölüm başlığı** eşleşmesi → o bölüm,
3. Eşleşme yoksa → ilk şovun son bölümü (araçta "bulamadım" demek yerine çalmak
   daha kullanışlıdır).

Türkçe karakter/aksan farkı ve komut kelimeleri ("çal", "oynat", "aç") yok
sayılır. Çözümleyici platformu bilmez; CarPlay `playFromVoice(query)` ile çağırır.

**Eksik (mac'te yapılacak):** Siri'nin uygulamaya konuşabilmesi için bir
**Intents Extension** gerekir (`INPlayMediaIntent`). Xcode'da hedef eklenip
gelen sorgu `CarPlayController.playFromVoice`'a iletilmelidir.

## 5. Mimari

```
src/carplay/
  CarPlayDependencies.ts     → CarPlay'in ihtiyaç duyduğu use case sözleşmesi
  controllers/
    CarPlayController.ts     → yaşam döngüsü + şablon akışı
  templates/
    sections.ts              → domain → liste öğesi dönüşümleri (SAF, test edilir)
```

İki kural:

1. **CarPlay, presentation'ı tanımaz.** Telefon arayüzüyle ortak olan tek şey
   domain use case'leridir; bağımlılık grafiği `app/di`'da paylaşılır
   (`getDependencies()`), böylece iki yüzey **aynı oynatıcı örneğini** kullanır.
2. **Şablon dönüşümleri saftır.** `sections.ts` native tipe bağlanmaz; bu
   sayede CarPlay olmadan (Windows dahil) test edilebilir.

## 6. Sonraki/önceki bölüm nasıl çalışıyor?

Bu komutlar arka plan servisinde (`playbackService`) karşılanır ama hangi
bölümün sıradaki olduğunu **kuyruk** bilir ve kuyruk presentation'da yaşar.
İkisini bağlamak için ince bir köprü vardır:

```
CarPlay / direksiyon tuşu
   └─ playbackService (infrastructure)
        └─ remoteQueueHandlers()          ← sözleşme
             └─ RemoteQueueBridge (presentation)  ← gerçek işleyiciler
```

Böylece infrastructure presentation'a bağımlı olmaz. İşleyici kayıtlı değilse
komutlar sessizce yok sayılır (tek bölüm çalarken "sonraki" anlamsızdır).

## 7. mac'te yapılacaklar

Kod hazır; kalanlar Xcode adımlarıdır.

Xcode projesi (`project.pbxproj`) repoda güncel: `CarPlaySceneDelegate.m`
derleme kaynaklarında, `AACP.entitlements` Debug yapılandırmasına bağlı.
Elle Xcode adımı kalmadı; `git pull` + temiz build yeterli.

1. **Simülatör testi:** *I/O → External Displays → CarPlay*.
2. **Gerçek cihaz / Release:** Apple Developer'dan
   `com.apple.developer.carplay-audio` başvurusu → onay → provisioning profile
   yenilenir → Release yapılandırmasına da `CODE_SIGN_ENTITLEMENTS` eklenir.

> `index.js` CarPlay kaydını `try/catch` içinde yapar; CarPlay yokken
> uygulama normal çalışır.

### Neden entitlement simülatörde de gerekiyor

Uygulamanın CarPlay menüsünde **listelenmesi** entitlement'a bağlıdır; simülatör
bunu provisioning profile ile doğrulamaz, yalnızca varlığına bakar. Bu yüzden
yetki Debug'a bağlandı: simülatörde CarPlay çalışır, Release imzalaması ise
Apple izni gelene kadar bozulmaz.

### Sahne yaşam döngüsü (siyah ekran tuzağı)

`Info.plist`'e sahne manifesti eklendiği an uygulama **tümüyle** sahne tabanlı
yaşam döngüsüne geçer ve `AppDelegate.didFinishLaunching` içinde oluşturulan
pencere ekrana bağlanmaz — uygulama siyah ekranda kalır.

Bu yüzden manifest iki rol tanımlar:

| Rol | Delege | Görev |
| --- | --- | --- |
| `UIWindowSceneSessionRoleApplication` | `SceneDelegate` (AppDelegate.swift içinde) | Telefon penceresini kurar, React Native'i başlatır |
| `CPTemplateApplicationSceneSessionRoleApplication` | `CarPlaySceneDelegate` (ObjC) | Arayüz denetleyicisini `RNCarPlay`e devreder |

`SceneDelegate` bilinçli olarak ayrı dosyada değil: Xcode projesine yeni Swift
dosyası eklemeden çalışması için `AppDelegate.swift` içinde durur. React Native
fabrikası AppDelegate'te kurulur, ilk sahne bağlandığında başlatılır; başlatma
seçenekleri (`launchOptions`) o ana kadar AppDelegate'te bekletilir.

## 8. Kısıtlar ve kararlar

- **Liste uzunlukları sınırlı**: devam listesi 12, bölüm listesi 50 öğe. Apple
  sürüş sırasında uzun listeleri kırpar; baştan sınırlamak, araçta beklenmedik
  kırpılmadan iyidir.
- **Boş listeler gizlenir** — araçta yer kaplamamalı.
- **Reklam çalarken** oynatıcı kontrolleri uygulamadaki kuralla aynı davranır:
  atlanamaz reklam sırasında sarma engellidir (bkz. [REKLAM.md](REKLAM.md)).
- **Arama sekmesi yok.** CarPlay klavyesi sürüş sırasında kilitlenir; arama
  yerine sesli komut doğru yoldur (§4).
