import Foundation
import MediaPlayer
import React

/**
 NowPlayingSession — sistemin oynatma kartında track-player'ın YAZMADIĞI
 alanları tamamlar.

 Kart üç ayrı bilgiden oluşur ve üçü de gerekir:

 | Bilgi | Alan | Kim yazar |
 | --- | --- | --- |
 | İçerik (başlık, sanatçı, kapak, süre, konum) | `nowPlayingInfo` | track-player |
 | Oynatma sürüyor mu | `playbackState` | **burası** |
 | Bu ne tür bir medya | `nowPlayingInfo[MediaType]` | **burası** |

 **`playbackState` yazılmazsa** `.unknown` kalır ve MediaRemote uygulamayı
 "çalan oynatıcı" olarak SEÇMEZ:

     [MRDElectedPlayerController] ElectedPlayer changed ... to <(null)>
     ... selectionReason = <... (AACP)/player-... is not playing>

 Kart dolu olsa bile kilit ekranında ve Dynamic Island'da hiçbir şey görünmez.

 **`MPNowPlayingInfoPropertyMediaType` yazılmazsa** öğe `.none` türünde kalır;
 sistem onu çalınabilir bir ses parçası saymaz ve kartı EKSİK çizer: kapak ve
 sürgü gelir ama taşıma tuşları (oynat/duraklat, atla) çıkmaz, çalıyor
 göstergesi canlanmaz. Komutlar kayıtlı olduğu hâlde çizilmemesinin sebebi
 budur.

 Bu köprü gerekli çünkü `react-native-track-player` (ve altındaki SwiftAudioEx)
 bu iki alanı hiçbir yerde yazmıyor. Kütüphane bunları üstlendiğinde burası
 kaldırılabilir.

 > Alanlar **birleştirilerek** yazılır: kartın içeriği track-player'ındır,
 > burası yalnızca eksikleri ekler. Kütüphane kartı yalnızca parça/durum
 > değiştiğinde baştan yazar (oynatma boyunca yazmaz), bu yüzden aynı anlarda
 > tetiklenen bu tamamlama kalıcı olur.
 */
@objc(NowPlayingSession)
class NowPlayingSession: NSObject {

  /// Kurulum sırasında arayüze dokunulmaz; ana kuyruk gerekmez.
  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  /**
   Oynatma durumunu bildirir ve kartın eksik alanlarını tamamlar.

   - Parameter state: `playing`, `paused` ya da bunların dışında bir değer
     (durdu sayılır). Metin kullanılıyor çünkü sözleşmenin okunabilir ve
     platformdan bağımsız kalması gerekiyor; eşleme tek yerde, burada.
   */
  @objc(setPlaybackState:)
  func setPlaybackState(_ state: NSString) {
    let playbackState: MPNowPlayingPlaybackState
    switch state as String {
    case "playing":
      playbackState = .playing
    case "paused":
      playbackState = .paused
    default:
      playbackState = .stopped
    }

    // Oynatma kartı sistem arayüzüne aittir: ana kuyrukta güncellenir.
    DispatchQueue.main.async {
      let center = MPNowPlayingInfoCenter.default()

      var info = center.nowPlayingInfo ?? [:]
      // Ses parçası: sistem kartı buna bakarak taşıma tuşlarıyla çizer.
      info[MPNowPlayingInfoPropertyMediaType] = MPNowPlayingInfoMediaType.audio.rawValue
      // Podcast canlı yayın DEĞİLDİR; canlı sayılan öğede sürgü ve konum gizlenir.
      info[MPNowPlayingInfoPropertyIsLiveStream] = false
      // 1× taban hız: sistem, hız değişimlerini buna göre yorumlar.
      info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
      center.nowPlayingInfo = info

      center.playbackState = playbackState
    }
  }
}
