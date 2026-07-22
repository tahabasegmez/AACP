import { Episode, PlaybackState } from '@domain/entities';
import TrackPlayer, { Event, State } from 'react-native-track-player';
import { TrackPlayerAudioService } from '../TrackPlayerAudioService';

// Mock'a eklenen test yardımcıları (bkz. __mocks__/react-native-track-player.js).
const tp = TrackPlayer as unknown as {
  __emit: (event: string, payload: unknown) => void;
  __getCalls: () => Array<[string, ...unknown[]]>;
  __reset: () => void;
};

const episode: Episode = {
  id: 'ep1',
  showId: 'show1',
  title: 'Bölüm',
  description: '',
  audioUrl: 'https://media/ep1.mp3',
  durationSec: 600,
  publishedAt: '2026-07-20T00:00:00.000Z',
};

beforeEach(() => tp.__reset());

describe('TrackPlayerAudioService', () => {
  it('setup: player kurar, seçenekleri günceller (idempotent)', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    await svc.setup(); // ikinci kez çağrılınca tekrar kurmamalı
    const names = tp.__getCalls().map(c => c[0]);
    expect(names.filter(n => n === 'setupPlayer')).toHaveLength(1);
    expect(names).toContain('updateOptions');
  });

  it('play: reset + add + play sırasıyla çağrılır', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    await svc.play(episode);
    const names = tp.__getCalls().map(c => c[0]);
    expect(names).toEqual(
      expect.arrayContaining(['reset', 'add', 'play']),
    );
    expect(names.indexOf('reset')).toBeLessThan(names.indexOf('add'));
    expect(names.indexOf('add')).toBeLessThan(names.indexOf('play'));
  });

  it('subscribe: PlaybackState olayını domain durumuna yansıtır', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();

    const seen: PlaybackState[] = [];
    svc.subscribe(s => seen.push(s));

    tp.__emit(Event.PlaybackState, { state: State.Playing });
    expect(seen.at(-1)?.status).toBe('playing');

    tp.__emit(Event.PlaybackProgressUpdated, { position: 42, duration: 600 });
    expect(seen.at(-1)?.positionSec).toBe(42);
    expect(seen.at(-1)?.durationSec).toBe(600);
  });

  it('play sonrası abone loading + doğru currentEpisodeId görür', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    let last: PlaybackState | undefined;
    svc.subscribe(s => (last = s));
    await svc.play(episode);
    expect(last?.currentEpisodeId).toBe('ep1');
  });

  it('setRate durumu günceller', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    let last: PlaybackState | undefined;
    svc.subscribe(s => (last = s));
    await svc.setRate(1.5);
    expect(last?.rate).toBe(1.5);
  });
});
