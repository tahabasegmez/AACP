import { FeedCatalogEntry } from '@core/config';
import { InMemoryKeyValueStorage } from '@infrastructure';
import { RemoteShowCatalogRepository } from '../RemoteShowCatalogRepository';
import { RemoteCatalogDataSource } from '../../datasources';

const entry = (slug: string): FeedCatalogEntry => ({
  slug,
  feedUrl: `https://feeds/${slug}`,
  title: `Şov ${slug}`,
});

/** Çağrı sayan sahte uzak kaynak. */
class FakeRemote {
  calls = 0;
  constructor(private readonly behaviour: () => FeedCatalogEntry[]) {}
  async fetch(): Promise<FeedCatalogEntry[]> {
    this.calls += 1;
    return this.behaviour();
  }
}

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

const makeSut = (remote: FakeRemote, ttlMs = 60_000) => {
  const storage = new InMemoryKeyValueStorage();
  return {
    storage,
    repo: new RemoteShowCatalogRepository(
      remote as unknown as RemoteCatalogDataSource,
      storage,
      noopLogger,
      { remoteUrl: 'https://api/v1/catalog', ttlMs },
    ),
  };
};

describe('RemoteShowCatalogRepository', () => {
  it('katalogu sunucudan çeker', async () => {
    const remote = new FakeRemote(() => [entry('a'), entry('b')]);
    const { repo } = makeSut(remote);

    const result = await repo.getShows();

    expect(result.ok && result.value.map(s => s.id)).toEqual(['a', 'b']);
  });

  it('TTL içinde ikinci kez ağa çıkmaz', async () => {
    const remote = new FakeRemote(() => [entry('a')]);
    const { repo } = makeSut(remote);

    await repo.getShows();
    await repo.getShows();

    expect(remote.calls).toBe(1);
  });

  it('sunucu erişilemezse bayat önbelleği kullanır', async () => {
    let fail = false;
    const remote = new FakeRemote(() => {
      if (fail) {
        throw new Error('ağ yok');
      }
      return [entry('a')];
    });
    // TTL 0: her çağrıda yeniden çekmeye çalışır.
    const { repo } = makeSut(remote, 0);

    await repo.getShows();
    fail = true;
    const result = await repo.getShows();

    expect(result.ok && result.value.map(s => s.id)).toEqual(['a']);
  });

  it('BOŞ uzak liste önbelleği bozmaz (hatalı deploy koruması)', async () => {
    let empty = false;
    const remote = new FakeRemote(() => (empty ? [] : [entry('a')]));
    const { repo } = makeSut(remote, 0);

    await repo.getShows();
    empty = true;
    const result = await repo.getShows();

    // Boş yanıt yok sayılır; önceki katalog korunur.
    expect(result.ok && result.value.map(s => s.id)).toEqual(['a']);
  });

  it('hiç veri yoksa boş katalog döner, çökmez', async () => {
    const remote = new FakeRemote(() => {
      throw new Error('ağ yok');
    });
    const { repo } = makeSut(remote);

    const result = await repo.getShows();

    // Uygulamaya gömülü yedek liste YOK: ilk açılış çevrimdışıysa katalog boştur.
    expect(result.ok && result.value).toEqual([]);
  });

  it('bilinmeyen şov kimliği hata döner', async () => {
    const remote = new FakeRemote(() => [entry('a')]);
    const { repo } = makeSut(remote);

    const result = await repo.getShowById('yok');

    expect(result.ok).toBe(false);
  });
});
