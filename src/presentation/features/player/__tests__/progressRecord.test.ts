import { Episode } from '@domain/entities';
import { episodeForProgress } from '../progressRecord';

const episode = (id: string): Episode => ({
  id,
  showId: 'show1',
  title: `Bölüm ${id}`,
  description: '',
  audioUrl: `https://media/${id}.mp3`,
  durationSec: 600,
  publishedAt: '2026-07-20T00:00:00.000Z',
});

describe('episodeForProgress', () => {
  it('açık bölüm kayıtla AYNIYSA onu kullanır', () => {
    const current = episode('a');
    expect(episodeForProgress('a', current, [])).toBe(current);
  });

  it('açık bölüm BAŞKASIYSA kuyruktan doğru bölümü bulur', () => {
    // Bölüm değişiminde oynatıcı hâlâ eskisini tutarken store yenisini gösterir.
    const playing = episode('a');
    const opened = episode('b');

    expect(episodeForProgress('a', opened, [opened, playing])).toBe(playing);
  });

  it('bölüm hiçbir yerde yoksa META VERMEZ (yanlış meta yazmaktansa eksik)', () => {
    // Depo eksik alanlarda daha önce yazılmış doğru meta'yı korur; yanlış
    // başlık/kapak/audioUrl ise kaydı kalıcı olarak bozardı.
    expect(episodeForProgress('a', episode('b'), [episode('c')])).toBeUndefined();
  });

  it('açık bölüm yokken kuyruğa bakar', () => {
    const queued = episode('a');
    expect(episodeForProgress('a', null, [queued])).toBe(queued);
  });
});
