# Derin Bağlantı ve Paylaşım

Uygulamadan paylaşılan bir bölüm/şov bağlantısına tıklayan kişi, uygulama
kuruluysa doğrudan ilgili ekrana düşer; kurulu değilse içeriği tanıtan bir
sayfa görür.

## Adres biçimi

Paylaşılan adres her zaman **https**'tir (Worker adresi):

```
https://<worker>/s/e/<showSlug>/<episodeGuid>   → bölüm
https://<worker>/s/p/<showSlug>                 → şov
```

Uygulamanın kendi şeması yalnızca yönlendirme adımında kullanılır:

```
aacp://e/<showSlug>/<episodeGuid>
aacp://p/<showSlug>
```

Neden https paylaşılıyor: özel şema, uygulama kurulu değilken hiçbir şey
açmaz — bağlantıyı alan kişi ne paylaşıldığını dahi göremez. Ayrıca
WhatsApp/X gibi uygulamalar önizlemeyi (`og:` etiketleri) yalnızca https
adresinden okur.

Biçimin tek tanımı `src/domain/entities/ShareLink.ts` içindedir; hem kurma
(`shareUrl`) hem çözme (`parseShareUrl`) oradan gelir.

## Parçalar

| Katman | Dosya | İş |
|---|---|---|
| domain | `src/domain/entities/ShareLink.ts` | adres biçimi, kurma/çözme |
| presentation | `src/presentation/features/episode/shareEpisode.ts` | paylaşım sayfasını açar |
| presentation | `src/presentation/navigation/useDeepLinks.ts` | gelen bağlantıyı dinler |
| presentation | `src/presentation/navigation/navigationRef.ts` → `openShareTarget` | hedefe götürür |
| worker | `worker/src/routes/share.ts` | `/s/...` karşılama ve yönlendirme sayfası |
| iOS | `ios/AACP/Info.plist` (`CFBundleURLTypes`), `AppDelegate.swift` | şema kaydı + sahne köprüsü |
| Android | `android/app/src/main/AndroidManifest.xml` | `aacp` şeması için intent-filter |

Bölüm bağlantısı şov ekranına gider ve bölüm listeye indiğinde ayrıntı
paneli açılır (`ShowDetail` rotasının `episodeId` parametresi). Doğrudan
"bölüm ekranı" yoktur: bir bölüm her zaman şovunun içinde yaşar.

## iOS notu — sahne yaşam döngüsü

CarPlay sahnesi tanımlı olduğu için uygulama sahne tabanlı yaşam döngüsündedir.
Bu modda `AppDelegate.application(_:open:options:)` **çağrılmaz**:

- **Soğuk açılış**: bağlantı `scene(_:willConnectTo:options:)` içinde
  `connectionOptions.URLContexts` ile gelir ve başlatma seçeneklerine
  (`UIApplication.LaunchOptionsKey.url`) konur — `Linking.getInitialURL()`
  bu anahtarı okur. Bildirimle göndermek işe yaramazdı: JS henüz dinlemiyor.
- **Açıkken**: `scene(_:openURLContexts:)` gelir ve `RCTOpenURLNotification`
  bildirimi gönderilir (`Linking`'in `url` olayı).

## Sonraki adım — mağaza yayını

Bugün yalnızca özel şema yakalanıyor. https adresinin doğrudan uygulamayı
açması (Universal Links / App Links) mağaza yayınından sonra yapılabilir:

- **iOS**: `apple-app-site-association` dosyası alan adının kökünde,
  `Associated Domains` yetkisi (`applinks:<alan adı>`) uygulamada.
- **Android**: `.well-known/assetlinks.json` (imza parmak izi gerekir),
  intent-filter'a `android:autoVerify="true"` ve `https` şeması.

İkisi de dosyayı Worker'dan sunarak çözülebilir; imza bilgisi mağaza
sürümü çıkmadan bilinmediği için beklemede.
