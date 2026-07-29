import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  /// Telefon penceresi. Sahne yaşam döngüsünde `SceneDelegate` tarafından
  /// oluşturulur; burada tutulmasının sebebi pencereye AppDelegate üzerinden
  /// erişen kütüphanelerdir.
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  /// React Native ilk sahne bağlandığında başlatılır; başlatma seçenekleri
  /// o ana kadar burada bekletilir.
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    return true
  }
}

/**
 * SceneDelegate — telefon penceresinin sahne delegesi.
 *
 * Info.plist'te CarPlay sahnesi tanımlandığı an uygulama sahne tabanlı yaşam
 * döngüsüne geçer. Bu modda `AppDelegate`in oluşturduğu pencere ekrana
 * BAĞLANMAZ (siyah ekran); telefon arayüzünün de bir sahne rolü olması gerekir.
 *
 * Ayrı dosya yerine burada duruyor: Xcode projesine yeni dosya eklemeden
 * çalışsın diye. Info.plist bu sınıfı `$(PRODUCT_MODULE_NAME).SceneDelegate`
 * adıyla işaret eder.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "AACP",
      in: window,
      launchOptions: appDelegate.launchOptions
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
