import { InMemoryKeyValueStorage } from '@infrastructure';
import { DEFAULT_PREFERENCES } from '@domain/entities';
import {
  PREFERENCES_STORAGE_KEY,
  PreferencesRepositoryImpl,
} from '../PreferencesRepositoryImpl';

const makeSut = () => {
  const storage = new InMemoryKeyValueStorage();
  return { storage, repo: new PreferencesRepositoryImpl(storage) };
};

describe('PreferencesRepositoryImpl', () => {
  it('hiç kayıt yokken varsayılanları döner', async () => {
    const { repo } = makeSut();
    const result = await repo.get();
    expect(result.ok && result.value).toEqual(DEFAULT_PREFERENCES);
  });

  it('yazılan tercihi geri okur', async () => {
    const { repo } = makeSut();
    await repo.set('hideCompletedEpisodes', true);

    const result = await repo.get();
    expect(result.ok && result.value.hideCompletedEpisodes).toBe(true);
  });

  it('her tercihi AYRI kayıt olarak damgayla saklar', async () => {
    const { repo, storage } = makeSut();
    await repo.set('hideCompletedEpisodes', true);

    const raw = JSON.parse(storage.getString(PREFERENCES_STORAGE_KEY) ?? '{}');
    // Alan bazında damga, senkronda çakışmaların alan bazında çözülmesini sağlar.
    expect(raw.hideCompletedEpisodes.value).toBe(true);
    expect(typeof raw.hideCompletedEpisodes.updatedAt).toBe('number');
  });

  it('bozuk kayıt varsayılana düşer, çökmez', async () => {
    const { repo, storage } = makeSut();
    storage.set(PREFERENCES_STORAGE_KEY, '{"hideCompletedEpisodes":{"value":"evet"}}');

    const result = await repo.get();
    // Tür uyuşmayan değer yok sayılır.
    expect(result.ok && result.value).toEqual(DEFAULT_PREFERENCES);
  });

  it('okunamayan depo hata Result döner', async () => {
    const { repo, storage } = makeSut();
    storage.set(PREFERENCES_STORAGE_KEY, '{bozuk');

    const result = await repo.get();
    expect(result.ok).toBe(false);
  });
});
