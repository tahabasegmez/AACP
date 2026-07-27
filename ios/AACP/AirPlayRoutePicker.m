#import <React/RCTBridgeModule.h>

/**
 * AirPlayRoutePicker'ın React Native'e tanıtımı.
 *
 * Swift sınıfları RN'e doğrudan görünmez; bu köprü dosyası modülü ve
 * metotlarını JS tarafına kaydeder (AirPlayRoutePicker.swift içindeki
 * @objc imzalarıyla eşleşir).
 */
@interface RCT_EXTERN_MODULE (AirPlayRoutePicker, NSObject)

RCT_EXTERN_METHOD(present)

@end
