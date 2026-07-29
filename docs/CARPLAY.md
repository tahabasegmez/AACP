# CarPlay

Uygulamanın araç içi yüzeyi. Telefondaki arayüzden bağımsızdır ama **aynı
domain use case'lerini** kullanır: oynatma, kaldığın yer, listeler ve
indirmeler tek yerde yaşar.

## 1. Ekran yapısı

Kök, sekmeli bir düzendir (`TabBarTemplate`). Sekmeler araçtaki gerçek
ihtiyaca göre seçilmiştir — sürüş sırasında katalog gezmek değil, **bıraktığın
yerden devam etmek** esastır.

| Sekme | İçerik | Neden |
|---|---|---|
| **Devam et** | Yarıda bırakılan bölümler (en son dinlenen üstte) | Araçtaki en sık eylem; tek dokunuşla devam |
| **İndirilenler** | Çevrimdışı hazır bölümler | Araçta şebeke kopar; bunlar her zaman çalar |
| **Listelerim** | Kullanıcı listeleri + "Sonra dinle" → bölümler | Kullanıcının kendi seçkisi |

Bir bölüme dokunmak **kaldığı yerden** çalar ve Now Playing ekranını açar.

> **"Tüm şovlar" sekmesi bilinçli olarak yok.** Sürüş sırasında uzun katalog
> listelerinde gezinmek dikkat dağıtır. Şov listesi akışı kodda korunmuştur
> (`openShow`) ve sesli komut/derin bağlantı ile erişilebilir; sekme olarak
> eklemek istenirse `buildRoot` içine bir satır yeterlidir (Apple sınırı 5 sekme).

## 2. Now Playing

Sistem oynatma ekranı kullanılır; üzerine şunlar eklenmiştir:

| Öğe | Nereden gelir |
|---|---|
| Oynat/duraklat, **seek çubuğu** | Sistem (track-player `MPNowPlayingInfoCenter`'ı besler) |
| **30 sn ileri / 15 sn geri** | `Capability.JumpForward/Backward` |
| **Sonraki / önceki bölüm** | `Capability.SkipToNext/Previous` → uygulamanın kuyruğu |
| **Sıradakiler** | `upNextButton` → kuyruk listesi, dokununca o bölüme atlar |
| **Oynatma hızı** | `playback` düğmesi (1 → 1.25 → 1.5 → 2) |
| **Sonra dinleye ekle** | `add-to-library` düğmesi |

Apple, Now Playing'e en fazla **5 özel düğme** koymaya izin verir; ikisi
kullanılmıştır, yer vardır.

> **Arka plan rengi:** CarPlay'de template arka planı uygulamanın kontrolünde
> DEĞİLDİR. Now Playing ekranının rengini iOS, albüm kapağından kendisi türetir
> — telefondaki `CoverGradient` etkisinin karşılığı sistemde zaten vardır.
> Bizim yaptığımız, kapak görsellerini doğru biçimde sağlamaktır.

## 3. Kapak görselleri

Listelerde kapaklar gösterilir (`ListItem.image`). Görseller uzak adresten
yüklenir; çevrimdışıyken ya da yüklenemediğinde CarPlay yer tutucu gösterir ve
liste yine çalışır.

Çalan bölüm `isPlaying` ile işaretlenir ve oynatma değiştikçe listeler
**ağa çıkmadan** yeniden çizilir (`watchPlayback`).

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
