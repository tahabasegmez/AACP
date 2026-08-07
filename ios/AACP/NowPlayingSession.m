#import <React/RCTBridgeModule.h>

/**
 * NowPlayingSession'ın React Native'e tanıtımı.
 *
 * Swift sınıfları RN'e doğrudan görünmez; bu köprü dosyası modülü ve
 * metotlarını JS tarafına kaydeder (NowPlayingSession.swift içindeki
 * @objc imzalarıyla eşleşir).
 */
@interface RCT_EXTERN_MODULE (NowPlayingSession, NSObject)

RCT_EXTERN_METHOD(setPlaybackState : (NSString *)state)

@end
