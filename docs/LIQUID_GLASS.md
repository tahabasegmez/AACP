# Liquid Glass (iOS 26) Hazırlık ve Geçiş Notu

Bu belge, uygulamanın Apple'ın iOS 26 ile gelen **Liquid Glass** tasarım diline
sorunsuz geçebilmesi için yapılan hazırlığı ve gelecekteki geçiş adımlarını
özetler. Amaç: geçiş geldiğinde **çekirdek mimariyi değiştirmeden**, birkaç
izole bileşeni güncelleyerek adapte olabilmek.

## Liquid Glass nedir (özet)

- SwiftUI/UIKit seviyesinde yeni bir materyal katmanı: `glassEffect(_:in:)`
  (SwiftUI) ve `UIGlassEffect` / `UIVisualEffectView` (UIKit).
- Sistem chrome'u (navigation bar, tab bar, toolbar, sheet, alert) **Xcode 26
  SDK'sı ile derlenip** yeni deployment target kullanıldığında büyük oranda
  **otomatik** adapte olur — uygulama kodu değişmeden.
- Özel (custom) kontroller otomatik adapte **olmaz**; bunlar için ya sistem
  bileşenine geçilir ya da glass materyali native köprüyle eklenir.

## Uygulamanın mevcut durumu — neyin otomatik geleceği, neyin elle güncelleneceği

| Alan | Bugünkü uygulama | Liquid Glass geçişi |
| --- | --- | --- |
| Native nav bar | React Navigation `native-stack` (UINavigationController) | SDK 26 ile **otomatik** |
| Sistem sheet/alert | native modal sunumları | SDK 26 ile **otomatik** |
| Tab bar | **Özel** `AnimatedTabBar` (JS, `tabBar={() => null}` ile native gizli) | Elle: tek dosya — bkz. aşağısı |
| Alt sheet | **Özel** `BottomSheet` (RN Modal + Animated) | Elle: tek bileşen |
| Üst island scrim | **Özel** `TopScrim` (yarı-şeffaf koyu degrade) | Elle: tek dosya — degradeyi glass/blur ile değiştir |
| Kapak degradeleri | `CoverGradient` / `ImmersiveHeader` | İçerik dekoru; değişiklik gerekmez |

### Neden geçiş ucuz olacak — mimari seam'ler

Migrasyonu kolaylaştıran şey, glass'a dönüşecek yüzeylerin **tek bir yerde**
toplanmış olması:

1. **`TopScrim`** (`src/presentation/ui/TopScrim.tsx`) — island çevresindeki
   koyulaşma. Bugün `LinearGradient` ile yapılıyor (native bağımlılık yok).
   Liquid Glass geldiğinde bu tek bileşenin içi bir native blur/glass görünümüyle
   değiştirilir; çağıran hiçbir ekran değişmez (hepsi ortak `scrimScrollHandler`
   ve kök seviyedeki tek `TopScrim` üzerinden çalışır).
2. **`AnimatedTabBar`** (`src/presentation/navigation/AnimatedTabBar.tsx`) — tek
   bileşen. Ya native `UITabBar`'a (otomatik glass) geri dönülür ya da arka
   planına glass materyal eklenir.
3. **`BottomSheet`** (`src/presentation/ui/BottomSheet.tsx`) — tek bileşen;
   glass zeminli bir yüzeye bu dosyada geçilebilir.
4. **Tema token'ları** (`src/presentation/theme`) — renk/opaklık merkezî.
   Glass yüzeyler için gerekli yarı-şeffaf token'lar buraya eklenir, tüketiciler
   token okur; sabit renk kullanan yer yok.

Custom UI'ın hepsi `presentation/ui` ve `presentation/navigation` altında;
domain/data/infrastructure katmanları görselden tamamen bağımsız olduğu için
geçiş **yalnızca presentation** katmanını etkiler.

## Geçiş için yapılması gerekenler (iOS 26 çıktığında)

1. **Xcode 26 + iOS 26 SDK** ile derle; `IPHONEOS_DEPLOYMENT_TARGET`'ı destekle.
   Bu tek başına native nav bar / sheet / (native kullanılırsa) tab bar'ı adapte
   eder.
2. `Info.plist`'e geçici `UIDesignRequiresCompatibility` **eklemekten kaçın** —
   bu bayrak eski görünümü zorlar; yalnızca acil bir kırılma olursa köprü olarak
   kullanılır.
3. **`TopScrim`** içeriğini native glass/blur görünümüyle değiştir (ör.
   community `expo-glass-effect` / `UIVisualEffectView` köprüsü). Genel API aynı
   kalır.
4. **Tab bar** kararı: (a) native `UITabBar`'a dön (otomatik glass, en az bakım)
   veya (b) `AnimatedTabBar` arka planına glass ekle. Özel animasyon
   gerekmiyorsa (a) önerilir.
5. **`BottomSheet`** zeminini glass materyale geçir (opsiyonel; sistem sheet'e de
   dönülebilir).
6. Kontrast/erişilebilirlik: glass üstünde metin okunurluğunu doğrula; token'lardaki
   `text`/`textMuted` opaklıklarını gözden geçir.

## Şimdi bilinçli olarak yapılmayanlar

- Native glass köprüsü **eklenmedi**: iOS 26 SDK'sı ve kararlı community
  desteği yaygınlaşmadan native bağımlılık eklemek, build kırılması riskini
  (geçmişte reanimated/expo-modules-core'da yaşandığı gibi) erken taşımaktır.
  Bunun yerine glass'a dönüşecek yüzeyler tek dosyalara izole edildi.
- Böylece bugün **saf-RN, bağımlılıksız** kalıyoruz; geçiş geldiğinde değişiklik
  yüzeyi küçük ve öngörülebilir.

## Özet

Uygulama Liquid Glass'a **hazır**: görsel yüzeyler izole ve token-tabanlı,
core/domain/data katmanları görselden bağımsız. Geçiş, SDK bump + 3-4 izole
bileşenin (özellikle `TopScrim`, `AnimatedTabBar`) güncellenmesiyle sınırlı
kalacak şekilde tasarlandı.
