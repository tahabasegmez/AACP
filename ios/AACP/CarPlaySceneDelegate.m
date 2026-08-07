#import "CarPlaySceneDelegate.h"
#import <RNCarPlay.h>

/**
 * Bağlantı olayını JS'e ULAŞTIRIR.
 *
 * `RNCarPlay`in statik `connect`/`disconnect` metotları olayı yalnızca
 * `self.bridge` doluyken gönderir:
 *
 *     if (cp.bridge) { [cp sendEventWithName:@"didConnect" body:...]; }
 *
 * Köprüsüz mimaride (`RCTNewArchEnabled`) modülün `bridge` alanı DAİMA nil'dir
 * — olaylar sessizce düşer. Sonuç: uygulama açıkken araca bağlanınca JS tarafı
 * bunu hiç öğrenmiyor ve CarPlay ekranı boş kalıyordu; bağlantı kopunca da
 * `onDisconnect` çalışmadığı için şablon yığını modeli eskimiş kalıyor ve
 * sonraki bağlantıda yanlış şablon itiliyordu.
 *
 * Olay köprüden değil `RCTCallableJSModules` üzerinden de gönderilebiliyor;
 * modül örneğinden doğrudan yayınlamak bu yüzden çalışır. Köprü VARSA (eski
 * mimari) kütüphane olayı zaten göndermiştir: iki kez göndermek kök şablonun
 * iki kez kurulması demek olurdu, o yüzden yalnızca boşluk doldurulur.
 */
static void RNCPEmitWhenBridgeless(NSString *name, NSDictionary *body) {
  RNCarPlay *module = [RNCarPlay allocWithZone:nil];
  if (module.bridge == nil) {
    [module sendEventWithName:name body:body];
  }
}

@implementation CarPlaySceneDelegate

/** Araç bağlandı: arayüz denetleyicisini react-native-carplay'e devret. */
- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didConnectInterfaceController:(CPInterfaceController *)interfaceController {
  // React Native'i başlatma sorumluluğu AppDelegate'tedir: uygulamayı araç
  // açtığında telefon sahnesi hiç bağlanmaz ve JS'i başlatacak kimse olmaz.
  // (bkz. AppDelegate.observeCarPlayScene)
  CPWindow *carWindow = templateApplicationScene.carWindow;
  [RNCarPlay connectWithInterfaceController:interfaceController window:carWindow];

  // JS henüz yüklenmediyse bu olayın dinleyicisi yoktur; kütüphane o durumu
  // açılışta `checkForConnection` ile kendisi yakalar.
  RNCPEmitWhenBridgeless(@"didConnect", @{
    @"width": @(carWindow.bounds.size.width),
    @"height": @(carWindow.bounds.size.height),
    @"scale": @(carWindow.screen.scale)
  });
}

/** Bağlantı koptu: JS tarafı da haberdar edilir ki şablonlar temizlensin. */
- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didDisconnectInterfaceController:(CPInterfaceController *)interfaceController {
  [RNCarPlay disconnect];
  RNCPEmitWhenBridgeless(@"didDisconnect", @{});
}

@end
