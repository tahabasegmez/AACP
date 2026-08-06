import { Capability } from 'react-native-track-player';
import { NOTIFICATION_CAPABILITIES, remoteCapabilities } from '../capabilities';

/**
 * iOS'un Swift tarafı yetenekleri METİN olarak çözer:
 *   `Capability(rawValue: $0)` — enum: play, pause, togglePlayPause, stop,
 *   next, previous, jumpForward, jumpBackward, seek…
 *
 * Kütüphanenin JS enum'ı bu değerleri native sabitlerden okur ama TurboModule
 * şeması onları `number` diye bildirdiği için iOS'ta kullanılabilir metin
 * gelmez. Bu test, gönderdiğimiz değerlerin Swift'in tanıdığı biçimde
 * kaldığını sabitler — kütüphane düzeldiğinde de bozulmaz, çünkü doğru
 * değerler zaten bunlar.
 */
describe('remoteCapabilities', () => {
  it('iOS: Swift enum ham değerlerini gönderir', () => {
    expect(remoteCapabilities('ios')).toEqual([
      'play',
      'pause',
      'stop',
      'seek',
      'next',
      'previous',
    ]);
  });

  it('iOS: sarma tuşları YOK', () => {
    // iOS her iki tuş çiftini birden göstermez; sarma açıkken "sonraki/önceki
    // bölüm" gizlenirdi.
    expect(remoteCapabilities('ios')).not.toContain('jumpForward');
    expect(remoteCapabilities('ios')).not.toContain('jumpBackward');
  });

  it('Android: kütüphane enum değerlerini kullanır', () => {
    // Android'de sabitler gerçekten sayıdır ve şemayla uyuşur.
    expect(remoteCapabilities('android')).toEqual([
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SeekTo,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ]);
  });
});

describe('NOTIFICATION_CAPABILITIES', () => {
  it('durdurma ve sarma bildirimde çizilmez', () => {
    expect(NOTIFICATION_CAPABILITIES).toEqual([
      Capability.Play,
      Capability.Pause,
      Capability.SkipToPrevious,
      Capability.SkipToNext,
    ]);
  });
});
