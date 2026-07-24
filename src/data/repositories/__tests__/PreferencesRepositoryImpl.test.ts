import { InMemoryKeyValueStorage } from '@infrastructure';
import { DEFAULT_PREFERENCES } from '@domain/entities';
import { PreferencesRepositoryImpl } from '../PreferencesRepositoryImpl';

const make = () => new PreferencesRepositoryImpl(new InMemoryKeyValueStorage());

describe('PreferencesRepositoryImpl', () => {
  it('kayıt yoksa varsayılanları döner', async () => {
    const res = await make().get();
    expect(res.ok && res.value).toEqual(DEFAULT_PREFERENCES);
  });

  it('kaydeder ve okur', async () => {
    const repo = make();
    await repo.save({ themeMode: 'light', motion: 'reduced' });
    const res = await repo.get();
    expect(res.ok && res.value).toEqual({ themeMode: 'light', motion: 'reduced' });
  });

  it('geçersiz/eski alanları varsayılana normalize eder', async () => {
    const storage = new InMemoryKeyValueStorage();
    storage.set('preferences_v1', JSON.stringify({ themeMode: 'neon', motion: 'x' }));
    const res = await new PreferencesRepositoryImpl(storage).get();
    expect(res.ok && res.value).toEqual(DEFAULT_PREFERENCES);
  });
});
