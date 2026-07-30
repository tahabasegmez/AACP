import { Result, ok } from '@core/error';
import { Logger } from '@core/logger';
import {
  DownloadItem,
  Episode,
  INITIAL_PLAYBACK_STATE,
  PlaybackProgress,
  Playlist,
  SAVED_PLAYLIST_ID,
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

/** Testlerin şablonlara baktığı yüzey (mock'un sakladığı config). */
interface MockSection {
  header?: string;
  items: { text: string; imgUrl?: string }[];
}
interface MockList {
  config: {
    title?: string;
    sections: MockSection[];
    onItemSelect?: (e: { index: number }) => Promise<void>;
  };
}

/** Bekleyen ateşle-unut işleri (kapak indirme, şablon açma) tamamlar. */
const flush = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

/** Kaydedilen çağrıları ada göre bulur. */
const callsOf = (name: string) => tp.__getCalls().filter(([n]) => n === name);

/** Kök şablondaki sekmeler — testler kullanıcı gibi bunlar üzerinden ilerler. */
const tabs = (): MockList[] =>
  (callsOf('setRootTemplate').at(-1)?.[1] as { config: { templates: MockList[] } }).config
    .templates;

const headersOf = (tab: MockList): (string | undefined)[] =>
  tab.config.sections.map(section => section.header);

let continued: Episode | null = null;
let rate: number | null = null;
let saved: Episode | null = null;
/** Uygulamanın kuyruğunun testteki karşılığı (tek gerçek kaynak). */
let queue: { episodes: readonly Episode[]; index: number } = { episodes: [], index: -1 };

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
    // CarPlay uzak kapak kabul etmez; port yereli döner.
    artwork: { localUri: async (url: string) => `file:///cache/${url.split('/').pop()}` },
    playbackQueue: {
      setQueue: (episodes: readonly Episode[], index: number) => {
        queue = { episodes, index };
      },
      getQueue: () => queue,
    },
    ...overrides,
  }) as unknown as CarPlayDependencies;

beforeEach(() => {
  tp.__reset();
  continued = null;
  rate = null;
  saved = null;
  queue = { episodes: [], index: -1 };
});

describe('CarPlayController', () => {
  it('onConnect: üç sekmeli kök şablon kurar', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    expect(callsOf('setRootTemplate')).toHaveLength(1);
    expect(tabs().map(tab => tab.config.title)).toEqual([
      'Ana Sayfa',
      'Kitaplığın',
      'İndirilenler',
    ]);
  });

  it('Ana Sayfa başlıklı raflar gösterir', async () => {
    const withSaved = { ...playlist, id: SAVED_PLAYLIST_ID, name: 'Sonra dinle' };
    const deps = makeDeps({
      getPlaylists: { execute: async () => ok([withSaved]) },
    } as unknown as Partial<CarPlayDependencies>);

    await new CarPlayController(deps, noopLogger).onConnect();

    expect(headersOf(tabs()[0])).toEqual(['Dinlemeye devam', 'Sonra dinle']);
  });

  it("Kitaplığın sekmesi listeleri ve podcast'leri ayrı raflarda toplar", async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    const library = tabs()[1];
    expect(headersOf(library)).toEqual(['Listelerim', "Podcast'ler"]);
    expect(library.config.sections[0].items.map(i => i.text)).toEqual(['Sabah']);
    expect(library.config.sections[1].items.map(i => i.text)).toEqual(['Şov 1']);
  });

  it('Ana Sayfa: devam rafından seçim kaldığı yerden çalar', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    await tabs()[0].config.onItemSelect?.({ index: 0 });

    expect(continued?.id).toBe('e-resume');
    expect(continued?.audioUrl).toBe('https://resume.mp3');
  });

  it('raf sınırları aşılsa da index doğru satıra denk gelir', async () => {
    // İki raf üst üste: CarPlay index'i bölümler arasında SÜREKLİDİR.
    const withSaved = {
      ...playlist,
      id: SAVED_PLAYLIST_ID,
      name: 'Sonra dinle',
      episodes: [episode('e-saved')],
    };
    const deps = makeDeps({
      getPlaylists: { execute: async () => ok([withSaved]) },
    } as unknown as Partial<CarPlayDependencies>);

    await new CarPlayController(deps, noopLogger).onConnect();

    // 0 → devam rafı, 1 → "Sonra dinle" rafının ilk satırı.
    await tabs()[0].config.onItemSelect?.({ index: 1 });

    expect(continued?.id).toBe('e-saved');
  });

  it('indirilenlerden seçim çalar (çevrimdışı akış)', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    await tabs()[2].config.onItemSelect?.({ index: 0 });

    expect(continued?.id).toBe('e-dl');
  });

  it('bölüm çalınca Now Playing şablonu açılır', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    await tabs()[0].config.onItemSelect?.({ index: 0 });

    expect(callsOf('enableNowPlaying')).toHaveLength(1);
    expect(callsOf('pushTemplate').length).toBeGreaterThanOrEqual(1);
  });

  it('BOŞ listeler kitaplıkta gösterilmez', async () => {
    const deps = makeDeps({
      getPlaylists: {
        execute: async () => ok([playlist, { ...playlist, id: 'bos', name: 'Boş', episodes: [] }]),
      },
    } as unknown as Partial<CarPlayDependencies>);

    await new CarPlayController(deps, noopLogger).onConnect();

    expect(tabs()[1].config.sections[0].items.map(i => i.text)).toEqual(['Sabah']);
  });

  it('listeye dokununca bölümleri alt seviyede açar', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    await tabs()[1].config.onItemSelect?.({ index: 0 });

    const pushed = callsOf('pushTemplate').at(-1)?.[1] as MockList;
    expect(pushed.config.title).toBe('Sabah');
    expect(pushed.config.sections[0].items.map(i => i.text)).toEqual(['Bölüm e-pl']);
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
    await new CarPlayController(makeDeps(), noopLogger).onConnect();
    await tabs()[0].config.onItemSelect?.({ index: 0 });

    // Now Playing yapılandırmasındaki kaydet düğmesini tetikle.
    const nowPlaying = callsOf('pushTemplate').at(-1)?.[1] as {
      config?: { onButtonPressed?: (e: { id: string }) => void };
    };
    nowPlaying?.config?.onButtonPressed?.({ id: 'save' });

    expect(saved?.id).toBe('e-resume');
  });

  it('çalarken uygulamanın kuyruğunu dokunulan listeyle kurar', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    await tabs()[0].config.onItemSelect?.({ index: 0 });

    // Devam rafından çalmak bile bir bağlam kuyruğu bırakır: direksiyon
    // tuşları ve "Sıradakiler" boş kalmamalı.
    expect(queue.episodes.map(e => e.id)).toEqual(['e-resume']);
    expect(queue.index).toBe(0);
  });

  it('Now Playing tek örnektir ve köke dönülerek açılır', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    await tabs()[0].config.onItemSelect?.({ index: 0 });
    const first = callsOf('pushTemplate').at(-1)?.[1];
    await tabs()[0].config.onItemSelect?.({ index: 0 });
    const second = callsOf('pushTemplate').at(-1)?.[1];

    // Paylaşılan şablon (CPNowPlayingTemplate) yeniden yaratılmaz; aynı örneği
    // iki kez yığına eklemek iOS'ta çökmeye yol açar, bu yüzden önce köke dönülür.
    expect(second).toBe(first);
    expect(callsOf('popToRootTemplate')).toHaveLength(2);
  });

  it('"Sıradakiler" kuyruğu çalan bölümden itibaren gösterir', async () => {
    await new CarPlayController(makeDeps(), noopLogger).onConnect();

    // İndirilenler sekmesi kuyruk kurar, sonra Now Playing açılır.
    await tabs()[2].config.onItemSelect?.({ index: 0 });

    const nowPlaying = callsOf('pushTemplate').at(-1)?.[1] as {
      config?: { onUpNextButtonPressed?: () => void };
    };
    nowPlaying?.config?.onUpNextButtonPressed?.();
    await flush();

    const pushed = callsOf('pushTemplate').at(-1)?.[1] as MockList;
    expect(pushed.config.title).toBe('Sıradakiler');
    expect(pushed.config.sections[0].items.map(i => i.text)).toEqual(['İndirilmiş bölüm']);
  });

  it('aynı bölüm iki rafta birden görünmez', async () => {
    // "Sonra dinle" listesinde devam rafındaki bölüm de var.
    const withSaved = {
      ...playlist,
      id: SAVED_PLAYLIST_ID,
      name: 'Sonra dinle',
      episodes: [{ ...episode('e-resume'), title: 'Yarım kalan' }, episode('e-baska')],
    };
    const deps = makeDeps({
      getPlaylists: { execute: async () => ok([withSaved]) },
    } as unknown as Partial<CarPlayDependencies>);

    await new CarPlayController(deps, noopLogger).onConnect();

    const sections = tabs()[0].config.sections;
    expect(sections[0].items.map(i => i.text)).toEqual(['Yarım kalan']);
    expect(sections[1].items.map(i => i.text)).toEqual(['Bölüm e-baska']);
  });

  it('kapakları yerel dosya adresine çevirir', async () => {
    const withArt = {
      ...playlist,
      episodes: [{ ...episode('e-pl'), imageUrl: 'https://cdn/kapak.jpg' }],
    };
    const deps = makeDeps({
      getPlaylists: { execute: async () => ok([withArt]) },
    } as unknown as Partial<CarPlayDependencies>);

    await new CarPlayController(deps, noopLogger).onConnect();
    await tabs()[1].config.onItemSelect?.({ index: 0 });

    // Uzak adres verilirse native taraf ana iş parçacığında çöker.
    const pushed = callsOf('pushTemplate').at(-1)?.[1] as MockList;
    expect(pushed.config.sections[0].items[0].imgUrl).toBe('file:///cache/kapak.jpg');
  });

  it('indirilemeyen kapak satırı düşürmez', async () => {
    const deps = makeDeps({
      artwork: { localUri: async () => undefined },
    } as unknown as Partial<CarPlayDependencies>);

    await new CarPlayController(deps, noopLogger).onConnect();

    const items = tabs()[1].config.sections[1].items;
    expect(items.map(i => i.text)).toEqual(['Şov 1']);
    expect(items[0].imgUrl).toBeUndefined();
  });

  it('bir kaynak çökerse diğer sekmeler yine dolar', async () => {
    const deps = makeDeps({
      getPlaylists: {
        execute: async () => {
          throw new Error('depolama bozuk');
        },
      },
    } as unknown as Partial<CarPlayDependencies>);

    await new CarPlayController(deps, noopLogger).onConnect();

    // Listeler alınamadı ama devam rafı ve indirilenler yerinde.
    expect(tabs()[0].config.sections[0].items.map(i => i.text)).toEqual(['Yarım kalan']);
    expect(tabs()[2].config.sections[0].items.map(i => i.text)).toEqual(['İndirilmiş bölüm']);
  });

  it('kaynak hatası yakalanmayan promise bırakmaz', async () => {
    const deps = makeDeps({
      getResumeList: {
        execute: async () => {
          throw new Error('okunamadı');
        },
      },
    } as unknown as Partial<CarPlayDependencies>);

    await expect(
      new CarPlayController(deps, noopLogger).onConnect(),
    ).resolves.toBeUndefined();
  });

  it('boş veri uygulamayı düşürmez', async () => {
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
