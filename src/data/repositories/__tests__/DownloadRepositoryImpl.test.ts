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
    expect(dl.removed).toContain('/dl/guid-1_abc.mp3');
    const got = await repo.get(episode.id);
    expect(got.ok && got.value).toBeNull();
  });

  it('bölümün uzak adresini saklar (silinse de yeniden indirilebilsin)', async () => {
    const { repo } = make();
    const res = await repo.download(episode);
    expect(res.ok && res.value.audioUrl).toBe('https://media/x.mp3');
  });

  it('silinen bölüm tekrar indirilebilir', async () => {
    const { dl, repo } = make();
    await repo.download(episode);
    await repo.remove(episode.id);

    const again = await repo.download(episode);
    expect(again.ok).toBe(true);
    expect(again.ok && again.value.status).toBe('downloaded');
    const got = await repo.get(episode.id);
    expect(got.ok && got.value?.status).toBe('downloaded');
    expect(dl.downloaded).toHaveLength(2);
  });

  it('dosyası kaybolan kaydı listede göstermez ve temizler', async () => {
    const { dl, repo } = make();
    await repo.download(episode);

    // Dosya uygulama dışında silinmiş gibi davran (ör. iOS container değişimi).
    await dl.remove('/dl/guid-1_abc.mp3');

    const list = await repo.list();
    expect(list.ok && list.value).toHaveLength(0);

    // Kayıt kalıcı olarak temizlenmeli.
    const got = await repo.get(episode.id);
    expect(got.ok && got.value).toBeNull();
  });

  it('dosya adı saklanır; tam yol güncel dizinden türetilir', async () => {
    // iOS'ta uygulama container'ı (dolayısıyla mutlak yol) kurulumda değişir.
    // Aynı depo yeni bir dizinle okunduğunda kayıt yine çözülmelidir.
    const storage = new InMemoryKeyValueStorage();
    const oldDir = new FakeDownloader();
    const repoOld = new DownloadRepositoryImpl(oldDir, storage);
    await repoOld.download(episode);

    // Yeni "kurulum": farklı dizin, dosya orada mevcut.
    class NewDirDownloader extends FakeDownloader {
      downloadsDir() {
        return '/yeni-container/dl';
      }
    }
    const newDir = new NewDirDownloader();
    await newDir.download('https://media/x.mp3', '/yeni-container/dl/guid-1_abc.mp3');

    const repoNew = new DownloadRepositoryImpl(newDir, storage);
    const got = await repoNew.get(episode.id);
    expect(got.ok && got.value?.localPath).toBe('/yeni-container/dl/guid-1_abc.mp3');
  });

  it('yalnızca mutlak yol içeren ESKİ kayıtları da çözer (geriye dönük uyum)', async () => {
    const storage = new InMemoryKeyValueStorage();
    // Eski sürümün yazdığı biçim: fileName yok, mutlak localPath var.
    storage.set(
      'downloads_v1',
      JSON.stringify({
        'guid-1/abc': {
          episodeId: 'guid-1/abc',
          status: 'downloaded',
          localPath: '/eski-container/dl/guid-1_abc.mp3',
          episodeTitle: 'Bölüm',
        },
      }),
    );

    const dl = new FakeDownloader();
    await dl.download('https://media/x.mp3', '/dl/guid-1_abc.mp3'); // güncel dizinde mevcut

    const repo = new DownloadRepositoryImpl(dl, storage);
    const got = await repo.get('guid-1/abc');
    expect(got.ok && got.value?.localPath).toBe('/dl/guid-1_abc.mp3');
  });
});
