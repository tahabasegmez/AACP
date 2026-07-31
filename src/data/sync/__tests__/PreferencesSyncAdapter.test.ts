import { InMemoryKeyValueStorage } from '@infrastructure';
import { PreferencesRepositoryImpl } from '../../repositories/PreferencesRepositoryImpl';
import { PreferencesSyncAdapter } from '../PreferencesSyncAdapter';

const makeSut = () => {
  const storage = new InMemoryKeyValueStorage();
  return {
    storage,
    repo: new PreferencesRepositoryImpl(storage),
    adapter: new PreferencesSyncAdapter(storage),
  };
};

describe('PreferencesSyncAdapter', () => {
  it('her tercihi AYRI kayıt olarak gönderir', async () => {
    const { repo, adapter } = makeSut();
    await repo.set('hideCompletedEpisodes', true);

    const changes = await adapter.localChanges(0);

    expect(changes).toHaveLength(1);
    expect(changes[0].key).toBe('hideCompletedEpisodes');
    expect(JSON.parse(changes[0].value)).toBe(true);
    expect(changes[0].deleted).toBe(false);
  });

  it('verilen zamandan eski kayıtları göndermez', async () => {
    const { repo, adapter } = makeSut();
    await repo.set('hideCompletedEpisodes', true);

    expect(await adapter.localChanges(Date.now() + 1000)).toHaveLength(0);
  });

  it('uzak kayıt daha yeniyse uygulanır', async () => {
    const { repo, adapter } = makeSut();
    await repo.set('hideCompletedEpisodes', false);

    await adapter.applyRemote([
      {
        key: 'hideCompletedEpisodes',
        value: 'true',
        updatedAt: Date.now() + 5000,
        deleted: false,
      },
    ]);

    const result = await repo.get();
    expect(result.ok && result.value.hideCompletedEpisodes).toBe(true);
  });

  it('yerelde daha yeni değer varsa uzak veriyi yok sayar', async () => {
    const { repo, adapter } = makeSut();
    await repo.set('hideCompletedEpisodes', true);

    await adapter.applyRemote([
      { key: 'hideCompletedEpisodes', value: 'false', updatedAt: 1, deleted: false },
    ]);

    const result = await repo.get();
    expect(result.ok && result.value.hideCompletedEpisodes).toBe(true);
  });

  it('bozuk uzak değer yerel tercihi kirletmez', async () => {
    const { repo, adapter } = makeSut();
    await repo.set('hideCompletedEpisodes', true);

    await adapter.applyRemote([
      {
        key: 'hideCompletedEpisodes',
        value: '"metin"',
        updatedAt: Date.now() + 5000,
        deleted: false,
      },
    ]);

    const result = await repo.get();
    expect(result.ok && result.value.hideCompletedEpisodes).toBe(true);
  });

  it('kimlik değişiminde yerel tercihleri siler', async () => {
    const { repo, adapter } = makeSut();
    await repo.set('hideCompletedEpisodes', true);

    await adapter.clearLocal();

    const result = await repo.get();
    expect(result.ok && result.value.hideCompletedEpisodes).toBe(false);
  });
});
