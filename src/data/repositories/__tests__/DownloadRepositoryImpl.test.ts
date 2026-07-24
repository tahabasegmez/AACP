import { Downloader } from '@core/ports';
import { InMemoryKeyValueStorage } from '@infrastructure';
import { Episode } from '@domain/entities';
import { DownloadRepositoryImpl } from '../DownloadRepositoryImpl';

class FakeDownloader implements Downloader {
  public downloaded: string[] = [];
  public removed: string[] = [];
  private files = new Set<string>();

  downloadsDir() {
    return '/dl';
  }
  async download(url: string, destPath: string) {
    this.downloaded.push(destPath);
    this.files.add(destPath);
  }
  async remove(path: string) {
    this.removed.push(path);
    this.files.delete(path);
  }
  async exists(path: string) {
    return this.files.has(path);
  }
}

const episode: Episode = {
  id: 'guid-1/abc',
  showId: 's1',
  title: 'Bölüm',
  description: '',
  audioUrl: 'https://media/x.mp3',
  durationSec: 120,
  publishedAt: '2026-07-01',
  imageUrl: 'https://img/x.jpg',
};

const make = () => {
  const dl = new FakeDownloader();
  const repo = new DownloadRepositoryImpl(dl, new InMemoryKeyValueStorage());
  return { dl, repo };
};

describe('DownloadRepositoryImpl', () => {
  it('indirir, güvenli dosya adı kullanır ve meta ile saklar', async () => {
    const { dl, repo } = make();
    const res = await repo.download(episode);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('downloaded');
    // "/" gibi karakterler dosya adında güvenli hale gelir
    expect(dl.downloaded[0]).toBe('/dl/guid-1_abc.mp3');
    expect(res.value.localPath).toBe('/dl/guid-1_abc.mp3');
    expect(res.value.episodeTitle).toBe('Bölüm');
    expect(res.value.durationSec).toBe(120);
  });

  it('get ve list indirileni döner', async () => {
    const { repo } = make();
    await repo.download(episode);
    const got = await repo.get(episode.id);
    expect(got.ok && got.value?.status).toBe('downloaded');
    const list = await repo.list();
    expect(list.ok && list.value).toHaveLength(1);
  });

  it('indirilmemiş için get null döner', async () => {
    const { repo } = make();
    const got = await repo.get('yok');
    expect(got.ok && got.value).toBeNull();
  });

  it('remove dosyayı ve kaydı siler', async () => {
    const { dl, repo } = make();
    await repo.download(episode);
    await repo.remove(episode.id);
    expect(dl.removed).toEqual(['/dl/guid-1_abc.mp3']);
    const got = await repo.get(episode.id);
    expect(got.ok && got.value).toBeNull();
  });
});
