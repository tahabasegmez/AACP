import { Capability } from 'react-native-track-player';
import {
  REMOTE_CONTROL_LAYOUT,
  notificationCapabilities,
  remoteCapabilities,
} from '../remoteControls';

describe('remoteControls', () => {
  it('bölüm düzeni: önceki/sonraki bölüm tuşları', () => {
    expect(remoteCapabilities('episode')).toEqual([
      Capability.Play,
      Capability.Pause,
      Capability.SeekTo,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ]);
  });

  it('sarma düzeni: ileri/geri sarma tuşları', () => {
    expect(remoteCapabilities('seek')).toEqual([
      Capability.Play,
      Capability.Pause,
      Capability.SeekTo,
      Capability.JumpForward,
      Capability.JumpBackward,
    ]);
  });

  it('iki tuş çifti ASLA birlikte açılmaz', () => {
    // iOS kartta ikisini birden göstermez; ikisini birden açmak hangisinin
    // çizileceğini sisteme bırakmak olurdu.
    for (const layout of ['episode', 'seek'] as const) {
      const capabilities = remoteCapabilities(layout);
      const hasEpisode = capabilities.includes(Capability.SkipToNext);
      const hasSeek = capabilities.includes(Capability.JumpForward);
      expect(hasEpisode && hasSeek).toBe(false);
    }
  });

  it('Stop hiçbir düzende açılmaz', () => {
    // Apple `Stop`u canlı yayınlara ayırır; açık bırakıldığında sistem
    // duraklat yerine "durdur" çizebiliyor. Podcast'te doğru fiil duraklatmak.
    for (const layout of ['episode', 'seek'] as const) {
      expect(remoteCapabilities(layout)).not.toContain(Capability.Stop);
    }
  });

  it('bildirimde sürgü tuş olarak çizilmez', () => {
    expect(notificationCapabilities('episode')).not.toContain(Capability.SeekTo);
    // Geri kalan tuşlar aynen korunur.
    expect(notificationCapabilities('episode')).toEqual(
      remoteCapabilities('episode').filter(c => c !== Capability.SeekTo),
    );
  });

  it('uygulamanın seçimi bölüm değiştirmedir', () => {
    expect(REMOTE_CONTROL_LAYOUT).toBe('episode');
  });
});
