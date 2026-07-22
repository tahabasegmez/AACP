import { composeDependencies } from '../composeDependencies';

/**
 * Composition root smoke testi — tüm bağımlılık grafiği hatasız kurulabiliyor mu
 * ve beklenen use case'ler mevcut mu? (Template'in tüm uygulamayı render eden
 * testinin yerine geçer; UI render testi native mock'lar hazır olunca eklenecek.)
 */
describe('composeDependencies', () => {
  it('tüm bağımlılıkları hatasız kurar', () => {
    const deps = composeDependencies();
    expect(deps).toBeDefined();
  });

  it('beklenen use case ve servisleri sağlar', () => {
    const deps = composeDependencies();
    const expectedKeys = [
      'getShowCatalog',
      'getPodcastFeed',
      'playEpisode',
      'pausePlayback',
      'resumePlayback',
      'stopPlayback',
      'seekTo',
      'skipBy',
      'setPlaybackRate',
      'savePlaybackProgress',
      'getPlaybackProgress',
      'continueEpisode',
      'getResumeList',
      'audioPlayer',
    ] as const;
    for (const key of expectedKeys) {
      expect(deps[key]).toBeDefined();
    }
  });

  it('use case\'ler execute() ile çağrılabilir yapıda', () => {
    const deps = composeDependencies();
    expect(typeof deps.getShowCatalog.execute).toBe('function');
    expect(typeof deps.continueEpisode.execute).toBe('function');
  });
});
