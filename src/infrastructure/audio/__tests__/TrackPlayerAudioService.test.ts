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

const other: Episode = { ...episode, id: 'ep2', title: 'İkinci' };
const third: Episode = { ...episode, id: 'ep3', title: 'Üçüncü' };
const userPick: Episode = { ...episode, id: 'user', title: 'Kullanıcı seçimi' };

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

  it('setQueue: kuyruğu kütüphaneye verir ve konuma atlar', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    await svc.setQueue([episode, other], 1, 42);

    const names = tp.__getCalls().map(c => c[0]);
    expect(names).toEqual(expect.arrayContaining(['setQueue', 'skip', 'play']));
    expect(names.indexOf('setQueue')).toBeLessThan(names.indexOf('skip'));

    // Başlangıç saniyesi kütüphaneye VERİLİR; ayrıca seek edilmez.
    const skip = tp.__getCalls().find(c => c[0] === 'skip');
    expect(skip?.slice(1)).toEqual([1, 42]);
    expect(names).not.toContain('seekTo');
  });

  it('kuyruk oynatıcıdan okunur (bölüm ve kaynak korunur)', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    await svc.setQueue([episode, other], 0);

    const snapshot = await svc.getQueue();
    expect(snapshot.items.map(i => i.episode.id)).toEqual(['ep1', 'ep2']);
    expect(snapshot.items.every(i => i.source === 'context')).toBe(true);
    expect(snapshot.index).toBe(0);
  });

  it('kullanıcı eklemesi ÇALANIN ARDINA, bağlamın önüne girer', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    await svc.setQueue([episode, other, third], 0);

    await svc.enqueue(userPick);

    const snapshot = await svc.getQueue();
    expect(snapshot.items.map(i => i.episode.id)).toEqual(['ep1', 'user', 'ep2', 'ep3']);
    expect(snapshot.items[1].source).toBe('user');
  });

  it('ikinci kullanıcı eklemesi birincinin ARDINA girer', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    await svc.setQueue([episode, other], 0);

    await svc.enqueue(userPick);
    await svc.enqueue(third);

    const snapshot = await svc.getQueue();
    expect(snapshot.items.map(i => i.episode.id)).toEqual(['ep1', 'user', 'ep3', 'ep2']);
  });

  it('sonraki/önceki bölüm kütüphanenin kuyruğunda ilerler', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    await svc.setQueue([episode, other, third], 0);

    await svc.skipToNext();
    expect((await svc.getQueue()).index).toBe(1);

    await svc.skipToPrevious();
    expect((await svc.getQueue()).index).toBe(0);

    // Kuyruğun ucunda komut sessizce yok sayılır.
    await svc.skipToPrevious();
    expect((await svc.getQueue()).index).toBe(0);
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

  it('kuyruk kurulunca abone doğru currentEpisodeId görür', async () => {
    const svc = new TrackPlayerAudioService();
    await svc.setup();
    let last: PlaybackState | undefined;
    svc.subscribe(s => (last = s));
    await svc.setQueue([episode], 0);
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
