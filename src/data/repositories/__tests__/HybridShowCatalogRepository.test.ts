import { FeedCatalogEntry } from '@core/config';
import { AppError } from '@core/error';
import { Logger } from '@core/logger';
import { HttpClient } from '@core/ports';
import { InMemoryKeyValueStorage } from '@infrastructure';
import { RemoteCatalogDataSource } from '../../datasources';
import { HybridShowCatalogRepository } from '../HybridShowCatalogRepository';

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const bundled: readonly FeedCatalogEntry[] = [
  { slug: 'bundled-1', feedUrl: 'https://feeds/b1', title: 'Bundled 1' },
];

const remoteJson = JSON.stringify([
  { slug: 'remote-1', feedUrl: 'https://feeds/r1', title: 'Remote 1' },
  { slug: 'remote-2', feedUrl: 'https://feeds/r2', title: 'Remote 2', imageUrl: 'https://img/r2.jpg' },
  { slug: 'gecersiz' }, // feedUrl/title eksik → atlanmalı
]);

/** Davranışı test içinde değiştirilebilen sahte HttpClient. */
class FakeHttp implements HttpClient {
  public response: string | null = null;
  public shouldThrow = false;
  public calls = 0;

  async getText(): Promise<string> {
    this.calls++;
    if (this.shouldThrow) {
      throw AppError.network('offline');
    }
    return this.response ?? '';
  }

  async postJson<T>(): Promise<T | undefined> {
    this.calls++;
    if (this.shouldThrow) {
      throw AppError.network('offline');
    }
    return undefined;
  }
}

const makeSut = (
  http: FakeHttp,
  cfg: { remoteUrl?: string; ttlMs: number },
) => {
  const storage = new InMemoryKeyValueStorage();
  const remote = new RemoteCatalogDataSource(http);
  const repo = new HybridShowCatalogRepository(bundled, remote, storage, noopLogger, cfg);
  return { repo, storage };
};

describe('RemoteCatalogDataSource', () => {
  it('geçerli girişleri alır, geçersizleri atlar', async () => {
    const http = new FakeHttp();
    http.response = remoteJson;
    const entries = await new RemoteCatalogDataSource(http).fetch('https://x/shows.json');
    expect(entries.map(e => e.slug)).toEqual(['remote-1', 'remote-2']);
    expect(entries[1].imageUrl).toBe('https://img/r2.jpg');
  });

  it('dizi olmayan JSON hata verir', async () => {
    const http = new FakeHttp();
    http.response = '{"not":"array"}';
    await expect(new RemoteCatalogDataSource(http).fetch('https://x')).rejects.toMatchObject({
      code: 'PARSE',
    });
  });

  it('bozuk JSON hata verir', async () => {
    const http = new FakeHttp();
    http.response = 'not json';
    await expect(new RemoteCatalogDataSource(http).fetch('https://x')).rejects.toMatchObject({
      code: 'PARSE',
    });
  });
});

describe('HybridShowCatalogRepository', () => {
  it('remoteUrl yoksa bundled kullanır (ağa çıkmaz)', async () => {
    const http = new FakeHttp();
    const { repo } = makeSut(http, { ttlMs: 1000 });
    const res = await repo.getShows();
    expect(res.ok && res.value.map(s => s.id)).toEqual(['bundled-1']);
    expect(http.calls).toBe(0);
  });

  it('remote başarılıysa uzak katalogu (yetkili) döner ve cache\'ler', async () => {
    const http = new FakeHttp();
    http.response = remoteJson;
    const { repo } = makeSut(http, { remoteUrl: 'https://x/shows.json', ttlMs: 60_000 });

    const first = await repo.getShows();
    expect(first.ok && first.value.map(s => s.id)).toEqual(['remote-1', 'remote-2']);

    // İkinci çağrı: cache taze → ağa çıkmamalı (http artık patlasa bile).
    http.shouldThrow = true;
    const second = await repo.getShows();
    expect(second.ok && second.value.map(s => s.id)).toEqual(['remote-1', 'remote-2']);
    expect(http.calls).toBe(1); // yalnızca ilk çağrıda fetch
  });

  it('remote başarısız + cache yoksa bundled\'a düşer', async () => {
    const http = new FakeHttp();
    http.shouldThrow = true;
    const { repo } = makeSut(http, { remoteUrl: 'https://x/shows.json', ttlMs: 60_000 });
    const res = await repo.getShows();
    expect(res.ok && res.value.map(s => s.id)).toEqual(['bundled-1']);
  });

  it('remote başarısız + bayat cache varsa cache\'i kullanır (stale-while-error)', async () => {
    const http = new FakeHttp();
    http.response = remoteJson;
    // ttl=0 → cache hep bayat sayılır, böylece her çağrı yeniden fetch dener.
    const { repo } = makeSut(http, { remoteUrl: 'https://x/shows.json', ttlMs: 0 });

    await repo.getShows(); // cache dolar
    http.shouldThrow = true; // artık remote patlıyor
    const res = await repo.getShows();
    expect(res.ok && res.value.map(s => s.id)).toEqual(['remote-1', 'remote-2']);
  });

  it('boş uzak liste hatalı sayılır → fallback', async () => {
    const http = new FakeHttp();
    http.response = '[]';
    const { repo } = makeSut(http, { remoteUrl: 'https://x/shows.json', ttlMs: 60_000 });
    const res = await repo.getShows();
    expect(res.ok && res.value.map(s => s.id)).toEqual(['bundled-1']);
  });

  it('getShowById remote girişini bulur', async () => {
    const http = new FakeHttp();
    http.response = remoteJson;
    const { repo } = makeSut(http, { remoteUrl: 'https://x/shows.json', ttlMs: 60_000 });
    const res = await repo.getShowById('remote-2');
    expect(res.ok && res.value.feedUrl).toBe('https://feeds/r2');
  });
});
