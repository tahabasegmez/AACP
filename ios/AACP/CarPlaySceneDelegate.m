#import "CarPlaySceneDelegate.h"
#import <RNCarPlay.h>

@implementation CarPlaySceneDelegate

/** Araç bağlandı: arayüz denetleyicisini react-native-carplay'e devret. */
- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didConnectInterfaceController:(CPInterfaceController *)interfaceController {
  [RNCarPlay connectWithInterfaceController:interfaceController window:templateApplicationScene.carWindow];
}

/** Bağlantı koptu: JS tarafı da haberdar edilir ki şablonlar temizlensin. */
- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didDisconnectInterfaceController:(CPInterfaceController *)interfaceController {
  [RNCarPlay disconnect];
}

@end
