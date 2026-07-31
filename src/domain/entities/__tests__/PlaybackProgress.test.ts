import {
  COMPLETION_THRESHOLD,
  buildPlaybackProgress,
  completedPlaybackProgress,
} from '../PlaybackProgress';

describe('buildPlaybackProgress', () => {
  const now = new Date('2026-07-22T10:00:00.000Z');

  it('konum ve süreyi doğru saklar', () => {
    const p = buildPlaybackProgress('ep1', 120, 600, now);
    expect(p.episodeId).toBe('ep1');
    expect(p.positionSec).toBe(120);
    expect(p.durationSec).toBe(600);
    expect(p.updatedAt).toBe('2026-07-22T10:00:00.000Z');
    expect(p.completed).toBe(false);
  });

  it('negatif konumu 0\'a kırpar', () => {
    expect(buildPlaybackProgress('ep1', -5, 600, now).positionSec).toBe(0);
  });

  it('eşik üstünü tamamlandı sayar', () => {
    const almostEnd = 600 * COMPLETION_THRESHOLD;
    expect(buildPlaybackProgress('ep1', almostEnd, 600, now).completed).toBe(true);
    expect(buildPlaybackProgress('ep1', 599, 600, now).completed).toBe(true);
  });

  it('eşik altını tamamlanmadı sayar', () => {
    expect(buildPlaybackProgress('ep1', 300, 600, now).completed).toBe(false);
  });

  it('süre 0 ise tamamlanmadı sayar (sıfıra bölme yok)', () => {
    expect(buildPlaybackProgress('ep1', 100, 0, now).completed).toBe(false);
  });

  it('eşik %90: son dakikası dinlenmeyen bölüm bitmiş sayılır', () => {
    // 60 dakikalık bölümün 54. dakikası → dinlendi.
    expect(buildPlaybackProgress('ep1', 3240, 3600, now).completed).toBe(true);
    expect(buildPlaybackProgress('ep1', 3239, 3600, now).completed).toBe(false);
  });
});

describe('completedPlaybackProgress', () => {
  const now = new Date('2026-07-22T10:00:00.000Z');

  it('elle işaretlemede eşiğe bakmadan tamamlandı damgalar', () => {
    const p = completedPlaybackProgress('ep1', 600, now);
    expect(p.completed).toBe(true);
    // Konum sona alınır ki "kaldığın yerden devam" bölümü baştan başlatsın.
    expect(p.positionSec).toBe(600);
  });

  it('süresi bilinmeyen bölümü de işaretleyebilir', () => {
    const p = completedPlaybackProgress('ep1', 0, now);
    expect(p.completed).toBe(true);
    expect(p.positionSec).toBe(0);
  });

  it('gösterim meta verisini taşır', () => {
    const p = completedPlaybackProgress('ep1', 600, now, {
      episodeTitle: 'Başlık',
      showId: 's1',
    });
    expect(p.episodeTitle).toBe('Başlık');
    expect(p.showId).toBe('s1');
  });
});
