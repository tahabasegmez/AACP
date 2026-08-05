import { Episode } from '../Episode';
import {
  commandEpisode,
  commandPositionSec,
  parsePlaybackCommand,
  playCommand,
} from '../PlaybackCommand';

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
      rate: 1,
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
      rate: 1,
    });
  });
});

describe('commandPositionSec', () => {
  it('yaş yoksa konumu olduğu gibi verir', () => {
    // Aktarılan komut: kaynak cihaz zaten susmuştu, geçen süre dinlenmedi.
    expect(commandPositionSec(playCommand(episode, 100))).toBe(100);
  });

  it('yaş kadar ilerletir', () => {
    expect(commandPositionSec({ ...playCommand(episode, 100), ageMs: 12_000 })).toBe(112);
  });

  it('hızı hesaba katar', () => {
    // 1.5× dinleyen birinin 10 saniyesi 15 saniyelik sestir.
    const command = { ...playCommand(episode, 100, 1.5), ageMs: 10_000 };
    expect(commandPositionSec(command)).toBe(115);
  });

  it('bölüm süresini aşmaz', () => {
    // Çok yaşlanmış bir yayın, bölümün sonunu geçen bir saniye üretebilirdi.
    const command = { ...playCommand(episode, 1790), ageMs: 60_000 };
    expect(commandPositionSec(command)).toBe(1800);
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
