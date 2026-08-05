import { Episode } from '../Episode';
import { commandEpisode, parsePlaybackCommand, playCommand } from '../PlaybackCommand';

const episode: Episode = {
  id: 'ep-1',
  showId: 'show-1',
  title: 'Bölüm 1',
  description: 'çok uzun bir açıklama',
  audioUrl: 'https://cdn/ep1.mp3',
  durationSec: 1800,
  publishedAt: '2026-01-01T00:00:00.000Z',
  imageUrl: 'https://cdn/ep1.jpg',
};

describe('playCommand', () => {
  it('yalnızca oynatmaya yeten alanları taşır', () => {
    const command = playCommand(episode, 42.7);
    expect(command).toEqual({
      kind: 'play',
      episode: {
        id: 'ep-1',
        showId: 'show-1',
        title: 'Bölüm 1',
        audioUrl: 'https://cdn/ep1.mp3',
        durationSec: 1800,
        imageUrl: 'https://cdn/ep1.jpg',
      },
      positionSec: 42,
    });
  });

  it('negatif konumu sıfırlar', () => {
    expect(playCommand(episode, -5).positionSec).toBe(0);
  });
});

describe('parsePlaybackCommand', () => {
  it('geçerli komutu çözer', () => {
    const parsed = parsePlaybackCommand(playCommand(episode, 10));
    expect(parsed?.episode.id).toBe('ep-1');
    expect(parsed?.positionSec).toBe(10);
  });

  it('ses adresi olmayan komutu reddeder', () => {
    // Çalınamayacak bir komutu uygulamaya sokmak, sessizce boş bir oynatıcı
    // bırakırdı.
    expect(parsePlaybackCommand({ kind: 'play', episode: { id: 'x' } })).toBeNull();
  });

  it('tanınmayan girdiyi reddeder', () => {
    expect(parsePlaybackCommand(null)).toBeNull();
    expect(parsePlaybackCommand({ kind: 'stop' })).toBeNull();
  });

  it('eksik alanları güvenli varsayılanlarla doldurur', () => {
    const parsed = parsePlaybackCommand({
      kind: 'play',
      episode: { id: 'ep-2', audioUrl: 'https://cdn/ep2.mp3' },
    });
    expect(parsed).toEqual({
      kind: 'play',
      episode: {
        id: 'ep-2',
        showId: '',
        title: 'Bölüm',
        audioUrl: 'https://cdn/ep2.mp3',
        durationSec: 0,
        imageUrl: undefined,
      },
      positionSec: 0,
    });
  });
});

describe('commandEpisode', () => {
  it('komuttan çalınabilir bölüm kurar', () => {
    const built = commandEpisode(playCommand(episode, 0));
    expect(built.id).toBe('ep-1');
    expect(built.audioUrl).toBe('https://cdn/ep1.mp3');
    // Açıklama komutta taşınmaz; oynatma için gerekmez.
    expect(built.description).toBe('');
  });
});
