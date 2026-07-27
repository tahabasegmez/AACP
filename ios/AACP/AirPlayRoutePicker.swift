import AVKit
import Foundation
import React
import UIKit

/**
 AirPlayRoutePicker — sistem ses çıkış (AirPlay) seçicisini açan native modül.

 iOS'ta çıkış cihazı seçimi yalnızca Apple'ın kendi `AVRoutePickerView`'ı ile
 yapılabilir; programatik olarak cihaz listesi alınıp değiştirilemez. Bu yüzden
 modül ekranda GÖRÜNMEYEN bir route picker oluşturur ve JS'ten çağrıldığında
 onun düğmesine programatik olarak dokunur — sistem paneli açılır.

 Görünmez bir view kullanılmasının sebebi: React Native tarafında ayrı bir
 native view bileşeni sunmak yerine mevcut Player arayüzünü koruyup yalnızca
 sistem panelini tetiklemek istiyoruz.
 */
@objc(AirPlayRoutePicker)
class AirPlayRoutePicker: NSObject {

  /// Ana pencereye eklenen gizli seçici (tekrar tekrar oluşturulmaz).
  private var routePickerView: AVRoutePickerView?

  /// Bu modül UI'a dokunduğu için ana kuyrukta çalışmalıdır.
  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  /// Sistem çıkış cihazı seçicisini açar.
  @objc(present)
  func present() {
    DispatchQueue.main.async {
      guard let window = Self.keyWindow() else {
        return
      }

      let picker: AVRoutePickerView
      if let existing = self.routePickerView {
        picker = existing
      } else {
        // Kullanıcıya görünmemeli: sıfır boyutlu ve dokunulamaz.
        let created = AVRoutePickerView(frame: .zero)
        created.isHidden = true
        created.isUserInteractionEnabled = false
        window.addSubview(created)
        self.routePickerView = created
        picker = created
      }

      // Seçicinin içindeki düğmeye programatik dokunuş → sistem paneli açılır.
      for case let button as UIButton in picker.subviews {
        button.sendActions(for: .touchUpInside)
        return
      }
    }
  }

  /// Etkin pencereyi bulur (çoklu sahne desteğiyle).
  private static func keyWindow() -> UIWindow? {
    return UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .filter { $0.activationState == .foregroundActive }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
      ?? UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first
  }
}
