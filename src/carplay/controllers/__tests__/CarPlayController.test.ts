import { Result, ok } from '@core/error';
import { Logger } from '@core/logger';
import { Episode, Page, Show } from '@domain/entities';
import { CarPlay, ListTemplate } from 'react-native-carplay';
import { CarPlayDependencies } from '../../CarPlayDependencies';
import { CarPlayController } from '../CarPlayController';

const tp = CarPlay as unknown as {
  __getCalls: () => Array<[string, unknown]>;
  __reset: () => void;
};

const noopLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

const shows: Show[] = [
  { id: 's1', title: 'Şov 1', description: 'd1', author: 'AA', feedUrl: 'https://f1', categories: [] },
  { id: 's2', title: 'Şov 2', description: 'd2', author: 'AA', feedUrl: 'https://f2', categories: [] },
];

const episodes: Episode[] = [
  { id: 'e1', showId: 's1', title: 'Bölüm 1', description: '', audioUrl: 'https://a1.mp3', durationSec: 100, publishedAt: '' },
];

const page = <T>(items: T[]): Page<T> => ({
  items,
  total: items.length,
  offset: 0,
  limit: 50,
  hasMore: false,
});

let continued: Episode | null = null;

const deps = {
  getShowCatalog: { execute: async (): Promise<Result<readonly Show[]>> => ok(shows) },
  getShowEpisodes: {
    execute: async () => ok({ show: shows[0], episodes: page(episodes) }),
  },
  continueEpisode: {
    execute: async ({ episode }: { episode: Episode }) => {
      continued = episode;
      return ok(undefined);
    },
  },
} as unknown as CarPlayDependencies;

/** Son çağrılan CarPlay metodunun template config'ini döndürür. */
const lastTemplateConfig = () => {
  const calls = tp.__getCalls();
  const last = calls[calls.length - 1][1] as ListTemplate;
  return last.config;
};

beforeEach(() => {
  tp.__reset();
  continued = null;
});

describe('CarPlayController', () => {
  it('onConnect: şovları kök liste şablonu yapar', async () => {
    const controller = new CarPlayController(deps, noopLogger);
    await controller.onConnect();

    const calls = tp.__getCalls();
    expect(calls[0][0]).toBe('setRootTemplate');
    const config = lastTemplateConfig() as { title: string; sections: Array<{ items: Array<{ text: string }> }> };
    expect(config.title).toBe('Podcastler');
    expect(config.sections[0].items.map(i => i.text)).toEqual(['Şov 1', 'Şov 2']);
  });

  it('şov seçilince bölüm listesi push edilir', async () => {
    const controller = new CarPlayController(deps, noopLogger);
    await controller.onConnect();

    // Kök şablonun onItemSelect'ini tetikle (ilk şov).
    const rootConfig = lastTemplateConfig() as { onItemSelect: (a: { index: number }) => Promise<void> };
    await rootConfig.onItemSelect({ index: 0 });

    const calls = tp.__getCalls();
    expect(calls[calls.length - 1][0]).toBe('pushTemplate');
    const epConfig = lastTemplateConfig() as { title: string; sections: Array<{ items: Array<{ text: string }> }> };
    expect(epConfig.title).toBe('Şov 1');
    expect(epConfig.sections[0].items[0].text).toBe('Bölüm 1');
  });

  it('bölüm seçilince kaldığı yerden çalar + Now Playing gösterir', async () => {
    const controller = new CarPlayController(deps, noopLogger);
    await controller.onConnect();
    const rootConfig = lastTemplateConfig() as { onItemSelect: (a: { index: number }) => Promise<void> };
    await rootConfig.onItemSelect({ index: 0 });
    const epConfig = lastTemplateConfig() as { onItemSelect: (a: { index: number }) => Promise<void> };
    await epConfig.onItemSelect({ index: 0 });

    expect(continued?.id).toBe('e1');
    const names = tp.__getCalls().map(c => c[0]);
    expect(names).toContain('enableNowPlaying');
    expect(names[names.length - 1]).toBe('pushTemplate'); // NowPlayingTemplate
  });
});
