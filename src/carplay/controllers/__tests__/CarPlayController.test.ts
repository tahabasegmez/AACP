import { Result, ok } from '@core/error';
import { Logger } from '@core/logger';
import {
  DownloadItem,
  Episode,
  INITIAL_PLAYBACK_STATE,
  PlaybackProgress,
  Playlist,
  Show,
} from '@domain/entities';
import { CarPlay } from 'react-native-carplay';
import { CarPlayDependencies } from '../../CarPlayDependencies';
import { CarPlayController } from '../CarPlayController';

const tp = CarPlay as unknown as {
  __getCalls: () => Array<[string, unknown]>;
  __reset: () => void;
};

const noopLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

const show: Show = {
  id: 's1',
  title: 'Şov 1',
  description: 'd1',
  author: 'AA',
  feedUrl: 'https://f1',
  categories: [],
};

const episode = (id: string, title = `Bölüm ${id}`): Episode => ({
  id,
  showId: 's1',
  title,
  description: '',
  audioUrl: `https://${id}.mp3`,
  durationSec: 600,
  publishedAt: '',
});

const progress: PlaybackProgress = {
  episodeId: 'e-resume',
  positionSec: 120,
  durationSec: 600,
  updatedAt: '2026-07-20T10:00:00.000Z',
  completed: false,
  episodeTitle: 'Yarım kalan',
  audioUrl: 'https://resume.mp3',
};

const download: DownloadItem = {
  episodeId: 'e-dl',
  status: 'downloaded',
  fileName: 'e-dl.mp3',
  audioUrl: 'https://dl.mp3',
  episodeTitle: 'İndirilmiş bölüm',
  durationSec: 300,
};

const playlist: Playlist = {
  id: 'pl1',
  name: 'Sabah',
  episodes: [episode('e-pl')],
  createdAt: 1,
  updatedAt: 1,
};

/** Kaydedilen çağrıları ada göre bulur. */
const callsOf = (name: string) => tp.__getCalls().filter(([n]) => n === name);

let continued: Episode | null = null;
let rate: number | null = null;
let saved: Episode | null = null;

const makeDeps = (overrides?: Partial<CarPlayDependencies>): CarPlayDependencies =>
  ({
    getShowCatalog: { execute: async (): Promise<Result<readonly Show[]>> => ok([show]) },
    getShowEpisodes: {
      execute: async () =>
        ok({
          show,
          episodes: { items: [episode('e1')], total: 1, offset: 0, limit: 50, hasMore: false },
        }),
    },
    getResumeList: { execute: async () => ok([progress]) },
    getDownloads: { execute: async () => ok([download]) },
    getPlaylists: { execute: async () => ok([playlist]) },
    continueEpisode: {
      execute: async ({ episode: e }: { episode: Episode }) => {
        continued = e;
        return ok(undefined);
      },
    },
    setPlaybackRate: {
      execute: async ({ rate: r }: { rate: number }) => {
        rate = r;
        return ok(undefined);
      },
    },
    toggleSavedEpisode: {
      execute: async ({ episode: e }: { episode: Episode }) => {
        saved = e;
        return ok(true);
      },
    },
    resolveVoiceQuery: { execute: async () => ok(null) },
    audioPlayer: {
      getState: async () => ({ ...INITIAL_PLAYBACK_STATE, rate: 1 }),
      subscribe: () => () => undefined,
    },
    ...overrides,
  }) as unknown as CarPlayDependencies;

beforeEach(() => {
  tp.__reset();
  continued = null;
  rate = null;
  saved = null;
});

describe('CarPlayController', () => {
  it('onConnect: sekmeli kök şablon kurar', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    const roots = callsOf('setRootTemplate');
    expect(roots).toHaveLength(1);
  });

  it('üç sekmenin içeriğini doldurur (devam / indirilenler / listeler)', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    // Her sekme kendi verisiyle güncellenir.
    const updates = callsOf('updateSections');
    expect(updates.length).toBeGreaterThanOrEqual(3);
  });

  it('devam listesinden seçim kaldığı yerden çalar', async () => {
    const controller = new CarPlayController(makeDeps(), noopLogger);
    await controller.onConnect();

    await (controller as unknown as { onResumeSelect(i: number): Promise<void> }).onResumeSelect(0);

    expect(continued?.id).toBe('e-resume');
    expect(continued?.audioUrl).toBe('https://resume.mp3');
  });

  it('indirilenlerden seçim çalar (çevrimdışı akış)', async () => {
    const controller = new CarPlayController(makeDeps(), noopLogger);
    await controller.onConnect();

    await (
      controller as unknown as { onDownloadSelect(i: number): Promise<void> }
    ).onDownloadSelect(0);

    expect(continued?.id).toBe('e-dl');
  });

  it('bölüm çalınca Now Playing şablonu açılır', async () => {
    const controller = new CarPlayController(makeDeps(), noopLogger);
    await controller.onConnect();

    await (controller as unknown as { onResumeSelect(i: number): Promise<void> }).onResumeSelect(0);

    expect(callsOf('enableNowPlaying')).toHaveLength(1);
    expect(callsOf('pushTemplate').length).toBeGreaterThanOrEqual(1);
  });

  it('BOŞ listeler sekmede gösterilmez', async () => {
    const deps = makeDeps({
      getPlaylists: {
        execute: async () => ok([playlist, { ...playlist, id: 'bos', episodes: [] }]),
      },
    } as unknown as Partial<CarPlayDependencies>);

    const controller = new CarPlayController(deps, noopLogger);
    await controller.onConnect();

    const lists = (controller as unknown as { playlists: readonly Playlist[] }).playlists;
    expect(lists.map(p => p.id)).toEqual(['pl1']);
  });

  it('sesli sorgu eşleşirse o bölümü çalar', async () => {
    const target = episode('e-voice', 'Sesle bulundu');
    const deps = makeDeps({
      resolveVoiceQuery: {
        execute: async () => ok({ episode: target, show, kind: 'showLatest' as const }),
      },
    } as unknown as Partial<CarPlayDependencies>);

    const controller = new CarPlayController(deps, noopLogger);
    const played = await controller.playFromVoice('Şov 1 çal');

    expect(played).toBe(true);
    expect(continued?.id).toBe('e-voice');
  });

  it('sesli sorgu eşleşmezse hiçbir şey çalmaz', async () => {
    const controller = new CarPlayController(makeDeps(), noopLogger);
    const played = await controller.playFromVoice('olmayan şov');

    expect(played).toBe(false);
    expect(continued).toBeNull();
  });

  it('hız düğmesi sonraki değere geçer', async () => {
    const controller = new CarPlayController(makeDeps(), noopLogger);
    await (controller as unknown as { cycleSpeed(): Promise<void> }).cycleSpeed();

    expect(rate).toBe(1.25);
  });

  it('kaydet düğmesi bölümü "Sonra dinle"ye ekler', async () => {
    const controller = new CarPlayController(makeDeps(), noopLogger);
    await controller.onConnect();
    await (controller as unknown as { onResumeSelect(i: number): Promise<void> }).onResumeSelect(0);

    // Now Playing yapılandırmasındaki kaydet düğmesini tetikle.
    const nowPlaying = callsOf('pushTemplate').at(-1)?.[1] as {
      config?: { onButtonPressed?: (e: { id: string }) => void };
    };
    nowPlaying?.config?.onButtonPressed?.({ id: 'save' });

    expect(saved?.id).toBe('e-resume');
  });

  it('katalog hatası uygulamayı düşürmez', async () => {
    const deps = makeDeps({
      getResumeList: { execute: async () => ok([]) },
      getDownloads: { execute: async () => ok([]) },
      getPlaylists: { execute: async () => ok([]) },
    } as unknown as Partial<CarPlayDependencies>);

    await expect(
      new CarPlayController(deps, noopLogger).onConnect(),
    ).resolves.toBeUndefined();
  });
});
