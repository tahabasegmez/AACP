import { InMemoryKeyValueStorage } from '@infrastructure';
import { PlaybackProgressRepositoryImpl } from '@data';
import {
  Episode,
  INITIAL_PLAYBACK_STATE,
  PlaybackState,
} from '@domain/entities';
import { AudioPlayerService } from '@domain/services';
import {
  ContinueEpisode,
  GetResumeList,
  PlayEpisode,
  SavePlaybackProgress,
} from '@domain/usecases';

/** Çağrıları kaydeden sahte oynatıcı. */
class FakePlayer implements AudioPlayerService {
  played: Episode | null = null;
  seekedTo: number | null = null;
  private state: PlaybackState = INITIAL_PLAYBACK_STATE;

  async setup() {}
  async play(episode: Episode) {
    this.played = episode;
  }
  async resume() {}
  async pause() {}
  async stop() {}
  async seekTo(positionSec: number) {
    this.seekedTo = positionSec;
  }
  async setRate() {}
  async getState() {
    return this.state;
  }
  subscribe() {
    return () => {};
  }
}

const episode = (id: string): Episode => ({
  id,
  showId: 'show1',
  title: `Bölüm ${id}`,
  description: '',
  audioUrl: `https://media.example.com/${id}.mp3`,
  durationSec: 600,
  publishedAt: '2026-07-20T00:00:00.000Z',
});

const makeSut = () => {
  const storage = new InMemoryKeyValueStorage();
  const repo = new PlaybackProgressRepositoryImpl(storage);
  const player = new FakePlayer();
  const playEpisode = new PlayEpisode(player);
  return {
    repo,
    player,
    save: new SavePlaybackProgress(repo),
    continueEpisode: new ContinueEpisode(repo, playEpisode),
    resumeList: new GetResumeList(repo),
  };
};

describe('PlaybackProgress kalıcılığı', () => {
  it('kaydeder, okur ve siler', async () => {
    const { repo, save } = makeSut();
    await save.execute({ episodeId: 'ep1', positionSec: 120, durationSec: 600 });

    const got = await repo.get('ep1');
    expect(got.ok && got.value?.positionSec).toBe(120);

    await repo.remove('ep1');
    const after = await repo.get('ep1');
    expect(after.ok && after.value).toBeNull();
  });

  it('getAll en son güncelleneni üste koyar', async () => {
    const { repo, save } = makeSut();
    await save.execute({ episodeId: 'a', positionSec: 10, durationSec: 600 });
    await new Promise<void>(r => setTimeout(() => r(), 5));
    await save.execute({ episodeId: 'b', positionSec: 10, durationSec: 600 });

    const all = await repo.getAll();
    expect(all.ok && all.value.map(p => p.episodeId)).toEqual(['b', 'a']);
  });
});

describe('GetResumeList', () => {
  it('tamamlanan ve hiç ilerlemeyen bölümleri hariç tutar', async () => {
    const { save, resumeList } = makeSut();
    await save.execute({ episodeId: 'yarim', positionSec: 200, durationSec: 600 });
    await save.execute({ episodeId: 'bitti', positionSec: 590, durationSec: 600 });
    await save.execute({ episodeId: 'baslamadi', positionSec: 0, durationSec: 600 });

    const list = await resumeList.execute();
    expect(list.ok && list.value.map(p => p.episodeId)).toEqual(['yarim']);
  });
});

describe('ContinueEpisode', () => {
  it('kayıtlı konumdan devam eder (seekTo çağrılır)', async () => {
    const { save, continueEpisode, player } = makeSut();
    await save.execute({ episodeId: 'ep1', positionSec: 150, durationSec: 600 });

    await continueEpisode.execute({ episode: episode('ep1') });

    expect(player.played?.id).toBe('ep1');
    expect(player.seekedTo).toBe(150);
  });

  it('kayıt yoksa baştan çalar (seekTo çağrılmaz)', async () => {
    const { continueEpisode, player } = makeSut();
    await continueEpisode.execute({ episode: episode('ep-new') });

    expect(player.played?.id).toBe('ep-new');
    expect(player.seekedTo).toBeNull();
  });

  it('tamamlanmış bölümü baştan çalar', async () => {
    const { save, continueEpisode, player } = makeSut();
    await save.execute({ episodeId: 'ep1', positionSec: 595, durationSec: 600 });

    await continueEpisode.execute({ episode: episode('ep1') });

    expect(player.seekedTo).toBeNull();
  });
});
