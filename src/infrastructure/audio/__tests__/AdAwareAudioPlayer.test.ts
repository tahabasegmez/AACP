import { ok } from '@core/error';
import {
  AdBreak,
  AdTrackingEvent,
  DEFAULT_AD_POLICY,
  Episode,
  INITIAL_PLAYBACK_STATE,
  PlaybackState,
} from '@domain/entities';
import { AdRepository, AdRequest } from '@domain/repositories';
import { AudioPlayerService } from '@domain/services';
import { AdAwareAudioPlayer } from '../AdAwareAudioPlayer';

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const episode = (overrides?: Partial<Episode>): Episode => ({
  id: 'ep-1',
  showId: 'sov-1',
  title: 'Bölüm 1',
  description: '',
  audioUrl: 'https://cdn/ep1.mp3',
  durationSec: 600,
  publishedAt: '',
  ...overrides,
});

/** Durumu elle sürülebilen sahte oynatıcı. */
class FakePlayer implements AudioPlayerService {
  state: PlaybackState = INITIAL_PLAYBACK_STATE;
  played: string[] = [];
  seeks: number[] = [];
  rates: number[] = [];
  private listeners = new Set<(s: PlaybackState) => void>();

  async setup(): Promise<void> {}
  async play(ep: Episode): Promise<void> {
    this.played.push(ep.audioUrl);
    this.emit({ status: 'playing', currentEpisodeId: ep.id, durationSec: ep.durationSec, positionSec: 0 });
  }
  async resume(): Promise<void> {}
  async pause(): Promise<void> {}
  async stop(): Promise<void> {}
  async seekTo(sec: number): Promise<void> {
    this.seeks.push(sec);
  }
  async setRate(rate: number): Promise<void> {
    this.rates.push(rate);
  }
  async getState(): Promise<PlaybackState> {
    return this.state;
  }
  subscribe(listener: (s: PlaybackState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /** Test yardımcısı: durumu değiştirip abonelere yayar. */
  emit(partial: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(l => l(this.state));
  }
}

const adBreak = (count = 1): AdBreak => ({
  placement: 'postroll',
  ads: Array.from({ length: count }, (_, i) => ({
    id: `ad-${i + 1}`,
    mediaUrl: `https://cdn/ad${i + 1}.mp3`,
    durationSec: 15,
    title: `Reklam ${i + 1}`,
    advertiser: 'Marka',
    tracking: {
      impression: [`https://izleme/imp${i + 1}`],
      complete: [`https://izleme/done${i + 1}`],
    },
  })),
});

class FakeAdRepository implements AdRepository {
  breakToReturn: AdBreak | null = adBreak();
  requests: AdRequest[] = [];
  tracked: Array<{ adId: string; event: AdTrackingEvent }> = [];

  async getAdBreak(request: AdRequest) {
    this.requests.push(request);
    return ok(this.breakToReturn);
  }
  async trackEvent(adId: string, event: AdTrackingEvent): Promise<void> {
    this.tracked.push({ adId, event });
  }
}

const makeSut = (opts?: { enabled?: boolean }) => {
  const inner = new FakePlayer();
  const ads = new FakeAdRepository();
  const player = new AdAwareAudioPlayer(inner, ads, silentLogger, {
    ...DEFAULT_AD_POLICY,
    enabled: opts?.enabled ?? true,
    minIntervalMs: 0,
  });
  const states: PlaybackState[] = [];
  player.subscribe(s => states.push(s));
  return { inner, ads, player, states };
};

/** Mikro görevlerin (await zincirlerinin) tamamlanmasını bekler. */
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

describe('AdAwareAudioPlayer', () => {
  it('bölüm bitince post-roll reklam çalar', async () => {
    const { inner, player, ads } = makeSut();
    await player.play(episode());

    inner.emit({ status: 'ended' });
    await flush();

    expect(ads.requests[0]?.placement).toBe('postroll');
    expect(inner.played).toContain('https://cdn/ad1.mp3');
  });

  it('reklam çalarken durumda ad bilgisi olur ve bölüm kimliği korunur', async () => {
    const { inner, player, states } = makeSut();
    await player.play(episode());

    inner.emit({ status: 'ended' });
    await flush();

    const adState = states.reverse().find(s => s.ad);
    expect(adState?.ad?.adId).toBe('ad-1');
    expect(adState?.ad?.skippable).toBe(false);
    expect(adState?.currentEpisodeId).toBe('ep-1'); // asıl bölüm korunur
  });

  it('reklam sırasında ileri sarma ve hız değişimi engellenir', async () => {
    const { inner, player } = makeSut();
    await player.play(episode());
    inner.emit({ status: 'ended' });
    await flush();

    await player.seekTo(10);
    await player.setRate(2);

    expect(inner.seeks).toHaveLength(0);
    expect(inner.rates).toHaveLength(0);
  });

  it('reklam bitmeden "ended" durumu dışarı sızmaz', async () => {
    const { inner, player, states } = makeSut();
    await player.play(episode());

    inner.emit({ status: 'ended' });
    await flush();

    // Reklam çalarken dışarıya 'ended' verilmemeli (kuyruk erken ilerlemesin).
    expect(states.filter(s => s.status === 'ended')).toHaveLength(0);
  });

  it('kesintideki tüm reklamlar bitince bölüm bitişi bildirilir', async () => {
    const { inner, ads, player, states } = makeSut();
    ads.breakToReturn = adBreak(2);
    await player.play(episode());

    inner.emit({ status: 'ended' }); // bölüm bitti → 1. reklam
    await flush();
    inner.emit({ status: 'ended' }); // 1. reklam bitti → 2. reklam
    await flush();
    expect(inner.played).toContain('https://cdn/ad2.mp3');
    expect(states.filter(s => s.status === 'ended')).toHaveLength(0);

    inner.emit({ status: 'ended' }); // 2. reklam bitti → kesinti tamam
    await flush();

    const ended = states.filter(s => s.status === 'ended');
    expect(ended).toHaveLength(1);
    expect(ended[0].ad).toBeUndefined();
  });

  it('izleme olaylarını (impression/complete) bildirir', async () => {
    const { inner, ads, player } = makeSut();
    await player.play(episode());

    inner.emit({ status: 'ended' });
    await flush();
    expect(ads.tracked).toContainEqual({ adId: 'ad-1', event: 'impression' });

    inner.emit({ status: 'ended' }); // reklam bitti
    await flush();
    expect(ads.tracked).toContainEqual({ adId: 'ad-1', event: 'complete' });
  });

  it('reklam yoksa bölüm bitişi normal şekilde bildirilir', async () => {
    const { inner, ads, player, states } = makeSut();
    ads.breakToReturn = null;
    await player.play(episode());

    inner.emit({ status: 'ended' });
    await flush();

    expect(states.filter(s => s.status === 'ended')).toHaveLength(1);
    expect(inner.played).toEqual(['https://cdn/ep1.mp3']); // reklam çalınmadı
  });

  it('politika kapalıyken reklam hiç istenmez', async () => {
    const { inner, ads, player, states } = makeSut({ enabled: false });
    await player.play(episode());

    inner.emit({ status: 'ended' });
    await flush();

    expect(ads.requests).toHaveLength(0);
    expect(states.filter(s => s.status === 'ended')).toHaveLength(1);
  });

  it('reklamsız akışta seek ve hız normal çalışır', async () => {
    const { inner, player } = makeSut();
    await player.play(episode());

    await player.seekTo(42);
    await player.setRate(1.5);

    expect(inner.seeks).toEqual([42]);
    expect(inner.rates).toEqual([1.5]);
  });
});
