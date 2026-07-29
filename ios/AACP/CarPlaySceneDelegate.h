#import <CarPlay/CarPlay.h>
#import <UIKit/UIKit.h>

/**
 * CarPlaySceneDelegate — CarPlay ekranının sahne delegesi.
 *
 * iOS, araç bağlandığında bu sınıfı örnekleyip arayüz denetleyicisini verir;
 * biz de onu `RNCarPlay`e bağlarız. Bağlantı kurulmadan JS tarafındaki
 * `CarPlay.registerOnConnect` dinleyicisi HİÇ tetiklenmez — uygulama CarPlay
 * menüsünde görünmez.
 *
 * Info.plist'teki `CPTemplateApplicationSceneSessionRoleApplication` girdisi bu
 * sınıfı adıyla işaret eder; ikisi birlikte gerekir.
 */
@interface CarPlaySceneDelegate : UIResponder <CPTemplateApplicationSceneDelegate>
@end
