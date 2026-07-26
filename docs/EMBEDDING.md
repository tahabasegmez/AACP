# Podcast'i Başka Bir Uygulamaya Gömme

Bu belge, AACP podcast özelliğinin **ayrı bir uygulama olarak kurulmadan**, mevcut
bir React Native uygulamasının içinde ("Podcasts" sekmesi/butonu) çalıştırılmasını
anlatır.

## 1. Nasıl çalışır

Podcast, standalone bir uygulama olmaktan çok **gömülebilir bir modül** olarak
yapılandırılmıştır. Üç parçadan oluşur:

| Parça | Ne yapar | Nereye konur |
|-------|----------|--------------|
| `PodcastProviders` | DI, sorgu/tema sağlayıcıları, oynatıcı köprüsü, senkron | Ana uygulamanın **kökü** |
| `PodcastNavigator` | Podcast'in tüm ekran ağacı | Ana stack'te **bir ekran** |
| `PodcastOverlays` | Mini player, tab bar, üst scrim | NavigationContainer'ın **üstü** |

Standalone uygulama ([AppRoot.tsx](../src/app/AppRoot.tsx)) da aynı üç parçayı
kullanır — tek fark NavigationContainer'ın kime ait olduğudur. Yani **iki mod da
aynı kodu paylaşır**, çatallanma yoktur.

> React Navigation v7 iç içe `NavigationContainer` desteklemez. Bu yüzden gömülü
> modda podcast kendi container'ını kurmaz; ana uygulamanınkine katılır.

## 2. Kurulum

### 2.1 Paketi ekle

Monorepo (önerilen):

```json
// ana uygulamanın package.json'ı
{
  "dependencies": {
    "aacp": "file:../AACP"
  }
}
```

Ya da git submodule / özel npm registry. Kaynak TypeScript olarak tüketilir;
ana uygulama kendi Metro/Babel'iyle derler (ayrı bir derleme adımı yok).

### 2.2 Ortak bağımlılıklar

Podcast bu paketleri kullanır; ana uygulamada da **aynı sürümler** bulunmalı
(RN'de tekilliği zorunlu olanlar işaretli):

```
react-native-track-player          ← tekil olmalı (ses oturumu)
react-native-mmkv + react-native-nitro-modules
@react-navigation/native + native-stack + bottom-tabs   ← tekil olmalı
react-native-safe-area-context     ← tekil olmalı
react-native-gesture-handler       ← tekil olmalı
react-native-screens               ← tekil olmalı
@tanstack/react-query
@shopify/flash-list
react-native-linear-gradient
react-native-vector-icons
react-native-fast-image
react-native-blob-util
@react-native-community/netinfo
react-native-image-colors@1.5.2    ← 2.x expo-modules-core ister, KULLANMA
```

Metro'nun aynı paketi iki kez yüklememesi için ana uygulamada `resolver.extraNodeModules`
veya npm workspaces ile tekilleştirin. **Çift kopya = çalışmayan navigasyon ve
iki ayrı oynatıcı** demektir.

### 2.3 Ana uygulamanın App.tsx'i

```tsx
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PodcastProviders,
  PodcastNavigator,
  PodcastOverlays,
  setNavigationRef,
} from 'aacp/embed';

const navigationRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PodcastProviders>
          <NavigationContainer
            ref={navigationRef}
            // Mini player'dan Player açılabilmesi için ref'i podcast'e bildir.
            onReady={() => setNavigationRef(navigationRef)}>
            <Stack.Navigator>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen
                name="Podcasts"
                component={PodcastNavigator}
                options={{ headerShown: false }}
              />
            </Stack.Navigator>
          </NavigationContainer>
          <PodcastOverlays />
        </PodcastProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Ana uygulamadaki "Podcasts" butonu:

```tsx
navigation.navigate('Podcasts');
```

### 2.4 Ana uygulamanın index.js'i

```js
import 'react-native-gesture-handler'; // EN ÜSTTE olmalı
import TrackPlayer from 'react-native-track-player';
import { podcastPlaybackService, registerCarPlay } from 'aacp/embed';
import { Platform } from 'react-native';

AppRegistry.registerComponent(appName, () => App);

// Kilit ekranı / CarPlay uzaktan kontrolleri
TrackPlayer.registerPlaybackService(() => podcastPlaybackService);

if (Platform.OS === 'ios') {
  try {
    registerCarPlay();
  } catch (e) {
    console.warn('CarPlay kaydı atlandı:', e);
  }
}
```

### 2.5 iOS native yapılandırma

Bunlar **uygulama seviyesindedir**, modüle taşınamaz — ana uygulamanın
`Info.plist`'ine eklenmeli:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

Ayrıca:
- `Podfile`'a podcast'in native bağımlılıkları (autolinking hallediyor).
- İndirme özelliği kullanılacaksa dosya erişimi ayarları.

## 3. CarPlay

**CarPlay entitlement'ı Apple tarafından uygulama bundle ID'sine verilir**, bir
modüle değil. Dolayısıyla teknik olarak tek seçenek: CarPlay ana uygulamaya
taşınır.

İyi haber: podcast tarafında CarPlay zaten izole bir katmandır
([src/carplay/](../src/carplay/)) ve `registerCarPlay()` tek satırla bağlanır
(§2.4). Yapılması gerekenler ana uygulamada:

1. Apple Developer'da **CarPlay Audio** entitlement başvurusu (ana uygulama için).
2. `.entitlements` dosyasına `com.apple.developer.carplay-audio`.
3. `SceneDelegate` yapılandırması (react-native-carplay dokümanı).

**Önerim:** Ana uygulamanın CarPlay arayüzü yoksa podcast'inkini olduğu gibi
taşıyın — hazır ve test edilmiş durumda. Ana uygulamanın kendi CarPlay arayüzü
varsa ikisi çakışır (bir uygulamada tek CarPlay scene olur); o durumda podcast
şablonları ana uygulamanın CarPlay kök şablonuna bir bölüm olarak eklenmelidir.

## 4. Yapılandırma

Sunucu adresi ve bölüm kaynağı [src/core/config/env.ts](../src/core/config/env.ts)
üzerinden gelir. Ana uygulama build zamanı değişkenleriyle besleyebilir
(`APP_API_BASE_URL`, `APP_EPISODE_SOURCE` — bkz. [BACKEND.md](BACKEND.md)).

`apiBaseUrl` boşsa podcast tamamen yerel çalışır; senkron ve telemetri sessizce
kapanır.

## 5. Bilinen kısıtlar

- **Tek oynatıcı:** `react-native-track-player` süreç başına tekildir. Ana
  uygulamanın da sesi varsa (video, canlı yayın) ikisi aynı anda çalamaz;
  oynatma denetimi tek bir yerden yönetilmelidir.
- **Tab bar çakışması:** Podcast kendi tab bar'ını (Ana sayfa/Ara/Kütüphane)
  `PodcastOverlays` içinde çizer. Ana uygulamanın da tab bar'ı varsa, podcast
  bölümündeyken ana tab bar'ı gizlemek gerekir (`tabBarStyle: { display: 'none' }`).
- **Mini player kapsamı:** `PodcastOverlays` ana uygulamanın kökündeyse mini
  player TÜM uygulamada görünür (Spotify davranışı). Yalnızca podcast bölümünde
  istenirse `PodcastNavigator` ile birlikte konumlandırılmalıdır.
- **Bundle boyutu:** Podcast ~10 native bağımlılık getirir. Ana uygulamada zaten
  varsa artış küçüktür.

## 6. Standalone mod hâlâ çalışıyor mu?

Evet. `index.js` → `App.tsx` → [AppRoot](../src/app/AppRoot.tsx) zinciri
korunmuştur; podcast tek başına da derlenip çalıştırılabilir. Bu, geliştirme ve
test için kullanışlıdır: özelliği ana uygulamayı ayağa kaldırmadan
çalıştırabilirsiniz.
