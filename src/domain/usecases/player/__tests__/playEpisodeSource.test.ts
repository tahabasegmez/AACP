import { Result, ok } from '@core/error';
import { DownloadItem, Episode, INITIAL_PLAYBACK_STATE, PlaybackState } from '@domain/entities';
import { DownloadRepository } from '@domain/repositories';
import { AudioPlayerService } from '@domain/services';
import { PlayEpisode } from '../PlayEpisode';

class FakePlayer implements AudioPlayerService {
  public played: Episode | null = null;
  async setup() {}
  async play(episode: Episode) {
    this.played = episode;
  }
  async resume() {}
  async pause() {}
  async stop() {}
  async seekTo() {}
  async setRate() {}
  async getState(): Promise<PlaybackState> {
    return INITIAL_PLAYBACK_STATE;
  }
  subscribe() {
    return () => {};
  }
}

class FakeDownloads implements DownloadRepository {
  constructor(private readonly item: DownloadItem | null) {}
  async get(): Promise<Result<DownloadItem | null>> {
    return ok(this.item);
  }
  async list(): Promise<Result<readonly DownloadItem[]>> {
    return ok([]);
  }
  async download(): Promise<Result<DownloadItem>> {
    return ok({ episodeId: 'x', status: 'downloaded' });
  }
  async remove(): Promise<Result<void>> {
    return ok(undefined);
  }
}

const episode: Episode = {
  id: 'ep1',
  showId: 's',
  title: 'T',
  description: '',
  audioUrl: 'https://media/remote.mp3',
  durationSec: 60,
  publishedAt: '',
};

describe('PlayEpisode kaynak çözümü', () => {
  it('indirilmişse yerel dosyayı çalar (file://)', async () => {
    const player = new FakePlayer();
    const downloads = new FakeDownloads({
      episodeId: 'ep1',
      status: 'downloaded',
      localPath: '/dl/ep1.mp3',
    });
    await new PlayEpisode(player, downloads).execute({ episode });
    expect(player.played?.audioUrl).toBe('file:///dl/ep1.mp3');
  });

  it('indirilmemişse uzak URL\'i çalar', async () => {
    const player = new FakePlayer();
    const downloads = new FakeDownloads(null);
    await new PlayEpisode(player, downloads).execute({ episode });
    expect(player.played?.audioUrl).toBe('https://media/remote.mp3');
  });

  it('downloadRepo yoksa uzak URL', async () => {
    const player = new FakePlayer();
    await new PlayEpisode(player).execute({ episode });
    expect(player.played?.audioUrl).toBe('https://media/remote.mp3');
  });
});
