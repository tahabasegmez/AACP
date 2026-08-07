import UIKit
// CarPlay sahne rolü sabiti (`UISceneSession.Role.carTemplateApplication`)
// bu modülden gelir.
import CarPlay
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

/**
 * ReactNativeBootstrap — React Native'i uygulama ömrü boyunca BİR KEZ başlatır.
 *
 * Sahne tabanlı yaşam döngüsünde uygulamayı hangi sahnenin açtığı önceden belli
 * DEĞİLDİR: kullanıcı telefondan açabilir, ya da araç bağlanınca yalnızca
 * CarPlay sahnesi açılabilir. Başlatmayı telefon sahnesine bağlamak, araçla
 * açılan uygulamada JS'in HİÇ çalışmaması demekti — `registerOnConnect`
 * dinleyicisi kaydolmaz, oynatıcı kurulmaz, araç ekranı boş kalırdı.
 *
 * Bu yüzden başlatma sahnelerden ALINDI: iki sahne de buraya sorar, kim önce
 * gelirse React Native'i o başlatır.
 *
 * Kök görünüm TEK örnektir. Telefon sahnesi geldiğinde yeniden başlatılmaz,
 * yalnızca pencereye bağlanır: ikinci kez başlatmak ikinci bir React ağacı
 * (iki store, iki zamanlayıcı, iki oynatıcı köprüsü) demekti.
 *
 * > Pencereye bağlanmamış kök görünüm de ÇALIŞIR: yüzey (surface) paket
 * > yürütüldükten sonra kendiliğinden başlar, penceresi olmasını beklemez.
 * > Böylece CarPlay'le açılan uygulamada da tüm arka plan köprüleri (oynatıcı
 * > durumu, "kaldığın yer" kaydı, uzaktan kuyruk komutları) ayaktadır.
 */
final class ReactNativeBootstrap {
  /// `app.json`'daki uygulama adı; `AppRegistry.registerComponent` ile aynı olmalı.
  private static let moduleName = "AACP"

  private let factory: RCTReactNativeFactory
  private let delegate: RCTDefaultReactNativeFactoryDelegate
  private let launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  private var rootViewController: UIViewController?

  /// React Native çalışıyor mu? (Paylaşım bağlantısının nasıl iletileceğini belirler.)
  var isStarted: Bool { rootViewController != nil }

  init(
    factory: RCTReactNativeFactory,
    delegate: RCTDefaultReactNativeFactoryDelegate,
    launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) {
    self.factory = factory
    self.delegate = delegate
    self.launchOptions = launchOptions
  }

  /**
   * React Native'i (henüz başlamadıysa) başlatır ve kök görünüm denetleyicisini
   * döndürür.
   *
   * - Parameter initialURL: uygulama KAPALIYKEN tıklanan paylaşım bağlantısı.
   *   Yalnızca ilk başlatmada anlamlıdır: bağlantıyı başlatma seçeneklerine
   *   koymak tek güvenli yol, çünkü bildirimle göndermek JS henüz dinlemediği
   *   için yutulurdu. `Linking.getInitialURL()` bu anahtarı okur.
   */
  @discardableResult
  func start(initialURL: URL? = nil) -> UIViewController {
    if let rootViewController {
      return rootViewController
    }

    var options: [AnyHashable: Any] = launchOptions ?? [:]
    if let initialURL {
      options[UIApplication.LaunchOptionsKey.url] = initialURL
    }

    let rootView = factory.rootViewFactory.view(
      withModuleName: Self.moduleName,
      initialProperties: nil,
      launchOptions: options
    )
    let controller = delegate.createRootViewController()
    delegate.setRootView(rootView, toRootViewController: controller)

    rootViewController = controller
    return controller
  }
}

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  /// Telefon penceresi. Sahne yaşam döngüsünde `SceneDelegate` tarafından
  /// oluşturulur; burada tutulmasının sebebi pencereye AppDelegate üzerinden
  /// erişen kütüphanelerdir.
  var window: UIWindow?

  /// React Native başlatıcısı — her iki sahne de bunu kullanır.
  private(set) var reactNative: ReactNativeBootstrap?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNative = ReactNativeBootstrap(
      factory: RCTReactNativeFactory(delegate: delegate),
      delegate: delegate,
      launchOptions: launchOptions
    )
    observeCarPlayScene()

    return true
  }

  /**
   * CarPlay sahnesi bağlanınca React Native'i başlatır.
   *
   * Uygulamayı ARAÇ açtığında telefon sahnesi HİÇ bağlanmaz ve JS'i başlatacak
   * başka kimse olmaz: `registerOnConnect` dinleyicisi kaydolmaz, oynatıcı
   * kurulmaz, araç ekranı boş kalır.
   *
   * Tetikleyici olarak bildirim seçildi; alternatifi CarPlay sahne delegesinin
   * (Objective-C) Swift tarafını tanımasıydı. O yol üretilen `-Swift.h`
   * başlığına bağımlı ve aynı hedef içinde derleme sırasına duyarlıdır —
   * bildirim, iki dili birbirine bağlamadan aynı işi görür.
   *
   * Telefon sahnesi kendi başlatmasını `SceneDelegate` içinde yapar: paylaşım
   * bağlantısını başlatma seçeneklerine koyabilmesi için orada olmalı.
   */
  private func observeCarPlayScene() {
    NotificationCenter.default.addObserver(
      forName: UIScene.willConnectNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard
        let scene = notification.object as? UIScene,
        scene.session.role == .carTemplateApplication
      else {
        return
      }
      self?.reactNative?.start()
    }
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
      let reactNative = appDelegate.reactNative
    else {
      return
    }

    let url = connectionOptions.urlContexts.first?.url
    // CarPlay önce açıldıysa React Native ZATEN çalışıyordur; o durumda
    // bağlantı başlatma seçeneklerinden okunamaz (o an çoktan geçilmiştir) ve
    // çalışan uygulamadaki yol kullanılır.
    let wasRunning = reactNative.isStarted
    let rootViewController = reactNative.start(initialURL: url)

    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = rootViewController
    self.window = window
    appDelegate.window = window
    window.makeKeyAndVisible()

    if wasRunning, let url {
      Self.notifyOpenURL(url)
    }
  }

  /// Uygulama AÇIKKEN gelen paylaşım bağlantısı. Sahne yaşam döngüsünde
  /// `AppDelegate.application(_:open:options:)` çağrılmaz; köprü burasıdır.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else {
      return
    }
    Self.notifyOpenURL(url)
  }

  /// RCTLinkingManager'ın dinlediği bildirim doğrudan gönderilir — böylece
  /// Swift tarafında ek bir modül içe aktarımına gerek kalmaz.
  private static func notifyOpenURL(_ url: URL) {
    NotificationCenter.default.post(
      name: NSNotification.Name("RCTOpenURLNotification"),
      object: nil,
      userInfo: ["url": url.absoluteString]
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
