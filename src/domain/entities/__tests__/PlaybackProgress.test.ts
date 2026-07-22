import { COMPLETION_THRESHOLD, buildPlaybackProgress } from '../PlaybackProgress';

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
});
