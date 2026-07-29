#import "CarPlaySceneDelegate.h"
#import <RNCarPlay.h>

@implementation CarPlaySceneDelegate

/** Araç bağlandı: arayüz denetleyicisini react-native-carplay'e devret. */
- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didConnectInterfaceController:(CPInterfaceController *)interfaceController
                          toWindow:(CPWindow *)window {
  [RNCarPlay connectWithInterfaceController:interfaceController window:window];
}

/** Bağlantı koptu: JS tarafı da haberdar edilir ki şablonlar temizlensin. */
- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didDisconnectInterfaceController:(CPInterfaceController *)interfaceController
                            fromWindow:(CPWindow *)window {
  [RNCarPlay disconnect];
}

@end
