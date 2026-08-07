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
yüklü olan bölüme dokunmak onu BAŞTAN başlatmaz — aynı bölüm birçok listede
görünür ve hangisinden dokunulursa dokunulsun dinlenen yer kaybolmamalı. Aynı
kural telefonda da geçerlidir (`usePlayEpisode`).

Yüklü bölüm **duraklatılmışsa** dokunuş oynatmayı **sürdürür**. Eskiden yalnızca
ekran açılıyordu: kullanıcı telefondan duraklatıp araçta bölüme dokunduğunda
hiçbir ses gelmiyor ve düğme bozuk görünüyordu. Bunun için oynatıcının
çalıyor/duraklatıldı durumu da izlenir — yalnızca "hangi bölüm" değişimini
dinlemek yetmiyordu.

> **Telefondan "oynat"a basmak araçtaki sırayı bozmamalı.** Telefonun
> `togglePlay`'i, bölüm oynatıcıya henüz yüklenmemişse yeni bir bağlam kuruyordu
> ve bu kuyruğu tek bölüme indiriyordu — CarPlay'de kurulmuş sıra siliniyor,
> "Sıradakiler" boşalıyordu. Artık kuyruk o bölümü zaten içeriyorsa yeniden
> kurulmaz, yalnızca oynatma başlatılır.

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
   oynatıcının kuyruğundan (`AudioPlayerService.getQueue`) gelir, dolayısıyla
   kilit ekranıyla aynı gerçeği gösterir ve biz biçimlendiririz.
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
| **Sonraki / önceki bölüm** | `Capability.SkipToNext/Previous` → oynatıcının kuyruğu (§6) |
| **Sıradakiler** | `upNextButton` → kuyruk listesi, dokununca o bölüme atlar |
| **Şov adı** | `albumArtistButton` → o şovun bölümleri (Spotify davranışı) |

Apple, Now Playing'e en fazla 5 özel düğme koymaya izin verir; **hiçbiri
kullanılmaz**. Hız ayarı ve "Sonra dinle'ye ekle" araçta anlamlı eylemler değil:
sürüş sırasında ayar değil dinleme yapılır, ikisi de telefonda duruyor.

**Sarma tuşları (15/30 sn) kapalıdır.** iOS kartta hem sarma hem bölüm değiştirme
tuşlarını birden göstermez; araçta bölüm değiştirmek daha sık gerekir, sarma
zaten sürgüyle yapılabilir. Karar tek yerdedir
([remoteControls](../src/infrastructure/audio/remoteControls.ts)) ve uygulama
genelidir — **kilit ekranını da** aynı şekilde etkiler.

`Capability.Stop` de kapalıdır: Apple onu canlı yayınlara ayırır ve açık
bırakıldığında sistem duraklat yerine bir "durdur" karesi çizebiliyor.

> Hız düğmesi bir dönem denendi ama üstündeki etiket daima `0×` gösteriyordu:
> o değeri iOS `MPNowPlayingInfoPropertyPlaybackRate`'ten okur ve oraya JS'ten
> yazılamaz. Yanlış bilgi gösteren bir düğme, hiç düğme olmamasından kötüdür.

### Paylaşılan şablon (çökme tuzağı)

`CPNowPlayingTemplate` bir **singleton**'dır — `react-native-carplay` her
`new NowPlayingTemplate(...)` çağrısında aynı native örneği yeniden yapılandırır.
Bundan iki kural doğar:

1. **Şablon bir kez kurulur.** Her oynatmada yeniden yaratmak, her seferinde bir
   olay dinleyicisi daha bağlamak olurdu. Bu yüzden düğme davranışları
   dokunulduğu anda güncel duruma bakar, şablona gömülmez.
2. **Aynı örnek yığına iki kez eklenemez** — iOS istisna fırlatır ve uygulama
   ÇÖKER. `popToTemplate` da yığında olmayan bir şablonla çağrılamaz. Bu yüzden
   açılmadan önce şablonun nerede olduğuna bakılır:

   | Durum | Yapılan |
   |---|---|
   | Tepede | Hiçbir şey |
   | Yığında ama tepede değil (üstüne liste itilmiş) | `popToTemplate` ile ona dönülür |
   | Yığında değil | `pushTemplate` |

   > Körlemesine `popToRootTemplate` çağrılmaz: kökteyken CarPlay bunu
   > *"No templates were available to be popped"* hatasıyla bildirir.

#### Yığın nasıl biliniyor

Kütüphane yığını sorgulamanın bir yolunu **vermez**. Durum önce üç boolean ile
tahmin ediliyordu ve bu yetmiyordu: **sistemin kendisi de** paylaşılan Now
Playing şablonunu açabilir (aracın kendi "şimdi çalıyor" düğmesi). O açılış
bizim modelimize yazılmadığı için, sonraki `pushTemplate` çağrımız çökme
sebebine dönüşüyordu — "CarPlay'de farklı bir bölüme dokununca uygulama
çöküyor" şikâyetinin kaynağı buydu.

Yerine `TemplateStack` (`src/carplay/templates/templateStack.ts`) geldi. Model
tek bir değişmez kuraldan beslenir:

> **Bir şablon göründüyse, o an yığının tepesindedir.**

- kök sekmelerden biri göründü → yığın **boş**,
- bilinen bir şablon göründü → üstündekiler **düştü**,
- **bilinmeyen** bir şablon göründü → sistem itmiş, modele **eklenir**.

Böylece kullanıcının "geri" tuşu, sistemin kendi gezinmesi ve bizim
itmelerimiz aynı kanaldan geçer. Model saftır ve ayrı test edilir.

#### Şablon ilk oynatmayı beklemez

Paylaşılan Now Playing şablonu **bağlantı anında** kurulur, ilk oynatmada
değil. Sebebi çökme:

Kütüphane bir şablonun kimliğini native tarafa ancak biz o şablonu
yarattığımızda yazar (`userInfo[@"templateId"]`). Sistem paylaşılan Now
Playing'i kendisi açabildiği için (aracın kendi "şimdi çalıyor" düğmesi),
kimlik yazılmadan bir "göründü" olayı gelebiliyordu:

```objc
[body setObject:[userInfo objectForKey:@"templateId"] forKey:@"templateId"];
```

`userInfo` boşken bu `setObject:nil` demektir — **NSInvalidArgumentException,
ana iş parçacığında çökme**. Şablonu bağlantıda yaratmak kimliği daima yazılı
tutar.

#### `enableNowPlaying` bir kez, kapatma yok

`react-native-carplay` 2.3.0'da bu metot bir bayrağı okur ama **hiç yazmaz**
(`isNowPlayingActive` hiçbir yerde atanmıyor):

```objc
if (enable && !isNowPlayingActive) { [... addObserver:self]; }
else if (!enable && isNowPlayingActive) { [... removeObserver:self]; }
```

Sonuç: her `true` çağrısı **bir gözlemci daha** ekler, `false` çağrısı hiçbir
şey yapmaz. Bağlantı kopup yeniden kurulduğunda tekrar çağırmak, "Sıradakiler"
ve şov düğmelerinin tek dokunuşta iki-üç kez tetiklenmesi (ve aynı şablonun üst
üste itilmesi) demekti. Bu yüzden uygulama ömrü boyunca **bir kez** çağrılır ve
`enableNowPlaying(false)` bilinçli olarak hiç çağrılmaz.

### Oynatma oturumu tek yerde yaşar

"Ne çalıyor ve sırada ne var" TEK yerde tutulur: **oynatıcının kendi kuyruğu**
(bkz. §6). CarPlay kendi kopyasını tutmaz; bir listeden çalmaya başlayınca
kuyruğu oynatmayla BİRLİKTE kurar, "Sıradakiler" de aynı kuyruktan okunur.

```
Telefon (playbackController) ─┐
                              ├─→ AudioPlayerService  ← tek gerçek kaynak
CarPlay (CarPlayController)  ─┘        ├─ kuyruk
                                       └─ çalan bölüm
```

Kuyruk ve çalan bölüm **birlikte** kurulur (`ContinueEpisode`'un `queue` +
`index` parametreleri). Bu bilinçlidir: ikisi ayrı ayrı ayarlanabildiği sürece
biri unutulabiliyordu — nitekim CarPlay yalnızca kuyruğu kurmuş, telefondaki
kapak ve başlık eski bölümde kalmıştı.

CarPlay kuyruğu asenkron okur ama şablon geri çağrıları senkrondur; bu yüzden
her tazeleme turunda bir kez okunup denetleyicide tutulur — şablonlar hep aynı
anlık görüntüyü görür.

### Oynatma kartının içeriği

Sistem Now Playing ekranını iOS `MPNowPlayingInfoCenter`'dan doldurur; oraya
yazan tek yer [playbackMapping](../src/infrastructure/audio/playbackMapping.ts).
Kartta yalnızca bölüm başlığının görünmemesi için şov adı `artist` alanına da
yazılır (`album` DOLDURULMAZ: CarPlay ikisini ayrı satırlarda gösterdiği için
şov adı iki kez çıkıyordu).

Kart oynatma başladıktan sonra **açıkça tazelenir**
(`updateNowPlayingMetadata`): `TrackPlayer.reset()` kartı temizlediği için parça
değişiminde boş kalabiliyor. Aynı alanlar tek fonksiyondan üretilir
(`episodeToNowPlaying`) ki parça bilgisiyle kart çelişmesin.

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

### Kaydın meta'sı kimliğiyle AYNI bölümden gelmeli

Kaydın kimliği **oynatıcıdan** gelir (gerçekte yüklü olan parça), gösterim
meta'sı ise uygulamanın durumundan. İkisi bölüm değişiminde kısa süreliğine
ayrışır: store yeni bölümü gösterirken oynatıcı hâlâ eskisini tutar.

O anda körlemesine "şu an açık olan bölüm"ün meta'sını yazmak kaydı **kalıcı
olarak bozuyordu** — A bölümünün kaydı B'nin başlığını, kapağını ve
`audioUrl`'ini alıyordu. İki sonucu vardı:

1. "Dinlemeye devam"da aynı bölüm iki kez görünüyordu (iki kimlik, aynı başlık),
2. o satıra dokunmak **yanlış bölümü** çalıyordu.

Depo alanları birleştirdiği (`?? existing`) için yanlış değer kendiliğinden de
düzelmiyordu. Artık meta, kaydın kimliğine ait bölümden çözülür
([progressRecord](../src/presentation/features/player/progressRecord.ts));
bölüm bulunamazsa meta hiç yazılmaz — **eksik meta, yanlış meta'dan iyidir.**

Cihazda kalmış eski bozuk kayıtlar için `GetResumeList` ikinci bir ayıklama
daha yapar: şov + başlık aynıysa tek satır kalır.

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

## 6. Kuyruk nerede yaşıyor?

**Kuyruğun tek sahibi oynatıcıdır** (`react-native-track-player`'ın kendi
kuyruğu). Uygulama ikinci bir sıra TUTMAZ.

```
setQueue / add / move / remove / skipToNext / skipToPrevious
        └─ track-player kuyruğu   ← TEK gerçek kaynak
             ├─ kilit ekranı & Dynamic Island
             ├─ CarPlay "Sıradakiler"
             ├─ direksiyon tuşları
             └─ playerQueueStore (yalnızca arayüz YANSIMASI)
```

> **Neden değişti.** Kuyruk bir dönem presentation'da (Zustand) yaşıyor,
> oynatıcıya ise tek parça yükleniyordu; "sonraki bölüm" komutları da el yapımı
> bir köprüyle bağlanıyordu. İki ayrı gerçek kaynak kaçınılmaz olarak ayrıştı:
> uygulamada 4 bölümlük sıra varken oynatıcıda 1 parça oluyor, kilit
> ekranındaki ve Dynamic Island'daki tuşlar uygulamadaki sırayı takip
> etmiyordu. Köprü (`remoteQueueCommands`, `bindRemoteQueue`) ve ayrı oturum
> portu (`PlaybackSessionService`) kaldırıldı.

### Sıralama kuralı

Bir şovun ya da listenin içinde bir bölüme dokunmak, **ardındaki bölümleri de
sıraya alır** (`context`). Kullanıcının elle eklediği bölüm ise **çalanın hemen
ardına**, bağlam bölümlerinin ÖNÜNE girer (`user`); birden çok ekleme kendi
aralarında sırasını korur.

```
çalan(context) → eklenen-1(user) → eklenen-2(user) → şovun devamı(context)…
```

Kaynak ayrımı (`context` / `user`) parçanın üstünde taşınır: kütüphane
tanımadığı alanları olduğu gibi saklayıp `getQueue()` ile geri verir
(`Track.originalObject`). Böylece ayrım için ikinci bir kayıt tutmak gerekmez.

### Uzaktan komutlar

`playbackService` artık tek satır: `RemoteNext → TrackPlayer.skipToNext()`.
Kuyruğun ucundaysak komutu kütüphane kendisi yok sayar ve sistem tuşu pasif
çizer — eskiden tuş etkin görünüp hiçbir şey yapmıyordu. Bölüm bitince
sıradakine geçmek de kütüphanenin işidir.

### Kuyruk dışarıdan ilerlediğinde

Sıra artık uygulamaya sorulmadan da ilerleyebilir (kilit ekranı, araç, bölüm
sonu). İki şey buna bağlanır ve ikisi de bir EKRANA değil uygulamanın ömrüne
aittir:

| Modül | İşi |
| --- | --- |
| `bindPlaybackQueueSync` | arayüzün yansımasını tazeler |
| `bindResumeOnEpisodeChange` | yeni bölümü kaldığı yerden sürdürür |

İkincisi olmasa kilit ekranından "sonraki" demek, yarım bırakılmış bir bölümü
baştan başlatırdı.

### Reklam

Oynatıcıyı saran reklam DECORATOR'ı kaldırıldı: tek parça çaldığını
varsaydığı için kuyruğun oynatıcıya taşınmasıyla uyumsuz kaldı. Geri
eklenecekse doğru yer yine composition root'tur — portu implement eden bir
sarmalayıcı, kuyruk çağrılarını da devretmelidir (bkz. REKLAM.md).

## 6.1 Oynatıcı kurulumu

`TrackPlayer.setupPlayer` çağrılmadan ses oturumu açılmaz, uzaktan kontroller
bağlanmaz ve **sistemin oynatma kartı (`MPNowPlayingInfoCenter`) boş kalır** —
araçta "çalan bölüme dair hiçbir şey görünmüyor" şikâyetinin sebebi buydu.

Kurulum eskiden yalnızca telefon arayüzünün bir efektinde isteniyordu. Artık
`CarPlayController.onConnect` de ister; `AudioPlayerService.setup()` tekrar
çağrılabilir. Bayrak yerine **söz (promise) hatırlanır**: iki çağrı aynı anda
gelirse ikisi de bayrağı boş görür ve `setupPlayer` iki kez çalışıp
`player_already_initialized` ile patlardı. İkinci çağıran artık aynı kurulumu
bekler ve döndüğünde oynatıcı gerçekten hazırdır.

## 6.2 Kartın "çalıyor mu" bilgisi

Oynatma kartının iki ayrı parçası vardır ve **ikisi de gereklidir**:

| Ne | Nereye yazılır | Kim yazar |
| --- | --- | --- |
| İçerik (başlık, sanatçı, kapak, süre, konum) | `MPNowPlayingInfoCenter.nowPlayingInfo` | track-player |
| Oynatma sürüyor mu | `MPNowPlayingInfoCenter.playbackState` | **biz** ([NowPlayingSession](../ios/AACP/NowPlayingSession.swift)) |

`react-native-track-player` (ve altındaki SwiftAudioEx) `playbackState`'i
**hiçbir yerde yazmıyor**; yazılmayınca `.unknown` kalır ve MediaRemote
uygulamayı "çalan oynatıcı" olarak seçmez:

```
[MRDElectedPlayerController] ElectedPlayer changed ... to <(null)>
    selectionReason = <... (AACP)/player-... is not playing>
```

Sonuç kafa karıştırıcıydı: kart TAM olarak doluyordu (başlık, sanatçı, 289 KB
kapak, `PlaybackRate = 1`, tüm uzaktan komutlar etkin) ama **kilit ekranında ve
Dynamic Island'da hiçbir şey görünmüyordu** — kayıt sisteme ulaşıyor, kimse
çizmiyordu.

Durum tek noktadan bildirilir: `TrackPlayerAudioService.update()` oynatma
durumunun geçtiği tek yerdir. Ara durumlar (yükleniyor, tamponluyor) "çalıyor"
sayılır — kullanıcı oynata bastığında kart hemen belirmeli, ilk parça yüklenene
kadar yanıp sönmemeli.

> Kütüphane bu alanı yazmaya başlarsa köprü kaldırılabilir.

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
dosyası eklemeden çalışması için `AppDelegate.swift` içinde durur.

#### React Native'i kim başlatır?

Uygulamayı hangi sahnenin açtığı önceden **belli değildir**. Kullanıcı
telefondan açabilir; araç bağlanınca **yalnızca CarPlay sahnesi** de açılabilir.
Başlatma bir zamanlar telefon sahnesine bağlıydı ve o durumda JS **hiç
çalışmıyordu**: `registerOnConnect` kaydolmuyor, oynatıcı kurulmuyor, araç
ekranı boş kalıyordu.

Bu yüzden başlatma sahnelerden alındı (`ReactNativeBootstrap`): kim önce gelirse
React Native'i o başlatır.

| Sahne | Ne yapar |
| --- | --- |
| Telefon (`SceneDelegate`) | Başlatır **ve** kök görünümü pencereye bağlar. Paylaşım bağlantısını başlatma seçeneklerine koyabilmek için başlatma burada yapılabilmeli. |
| CarPlay | `AppDelegate` sahne bildirimini dinler ve yalnızca **başlatır** (pencere yok). |

Kök görünüm **tek örnektir**; telefon sahnesi geldiğinde yeniden başlatılmaz,
yalnızca pencereye bağlanır. İkinci kez başlatmak ikinci bir React ağacı — iki
store, iki zamanlayıcı, iki oynatıcı köprüsü — demekti.

> Pencereye bağlanmamış kök görünüm de **çalışır**: yüzey (surface) paket
> yürütüldükten sonra kendiliğinden başlar, penceresi olmasını beklemez. Böylece
> araçla açılan uygulamada da arka plan köprüleri (oynatma durumu, "kaldığın
> yer" kaydı, uzaktan kuyruk komutları) ayaktadır.

CarPlay sahnesinin tetikleyicisi bir **bildirimdir**
(`UIScene.willConnectNotification`), Objective-C delegesinden Swift çağrısı
değil: o yol üretilen `-Swift.h` başlığına bağımlı ve aynı hedef içinde derleme
sırasına duyarlıdır.

#### Bağlantı olayları köprüsüz mimaride düşüyordu

`RNCarPlay` bağlan/kopar olaylarını yalnızca `bridge` doluyken gönderir:

```objc
if (cp.bridge) { [cp sendEventWithName:@"didConnect" body:...]; }
```

Köprüsüz mimaride (`RCTNewArchEnabled`) `bridge` **daima nil**'dir; olaylar
sessizce düşer. Sonuçları:

- uygulama **açıkken** araca bağlanınca JS bunu hiç öğrenmiyor, ekran boş
  kalıyordu (yalnızca uygulama CarPlay'le birlikte açıldığında çalışıyordu:
  kütüphane o durumu açılışta `checkForConnection` ile kendisi yakalar),
- bağlantı kopunca `onDisconnect` çalışmıyor, şablon yığını modeli eskimiş
  kalıyor ve sonraki bağlantıda yanlış şablon itiliyordu.

Olay `RCTCallableJSModules` üzerinden köprüsüz de gönderilebiliyor; boşluk
`CarPlaySceneDelegate` içinde doldurulur. Köprü varsa (eski mimari) kütüphane
olayı zaten göndermiştir — iki kez göndermek kök şablonun iki kez kurulması
demek olurdu.

#### Sekmeler yeniden bağlanmada yeniden yaratılmaz

Native taraf şablonları kimlikleriyle saklar ve her `new ListTemplate` bir olay
dinleyicisi daha bağlar. Araç her bağlandığında dört sekme daha yaratmak, tek
dokunuşun birden çok kez işlenmesi demekti. `onDisconnect` yalnızca yığın
modelini sıfırlar.

## 8. Kısıtlar ve kararlar

- **Liste uzunlukları sınırlı**: devam listesi 12, bölüm listesi 50 öğe. Apple
  sürüş sırasında uzun listeleri kırpar; baştan sınırlamak, araçta beklenmedik
  kırpılmadan iyidir.
- **Boş listeler gizlenir** — araçta yer kaplamamalı.
- **Reklam çalarken** oynatıcı kontrolleri uygulamadaki kuralla aynı davranır:
  atlanamaz reklam sırasında sarma engellidir (bkz. [REKLAM.md](REKLAM.md)).
- **Arama sekmesi yok.** CarPlay klavyesi sürüş sırasında kilitlenir; arama
  yerine sesli komut doğru yoldur (§4).
