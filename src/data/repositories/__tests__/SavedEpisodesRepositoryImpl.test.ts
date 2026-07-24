import { InMemoryKeyValueStorage } from '@infrastructure';
import { Episode } from '@domain/entities';
import { SavedEpisodesRepositoryImpl } from '../SavedEpisodesRepositoryImpl';

const ep = (id: string): Episode => ({
  id,
  showId: 's',
  title: `Bölüm ${id}`,
  description: '',
  audioUrl: `https://m/${id}.mp3`,
  durationSec: 100,
  publishedAt: '',
});

const make = () => new SavedEpisodesRepositoryImpl(new InMemoryKeyValueStorage());

describe('SavedEpisodesRepositoryImpl', () => {
  it('başta boş', async () => {
    const res = await make().list();
    expect(res.ok && res.value).toEqual([]);
  });

  it('toggle ekler ve çıkarır', async () => {
    const repo = make();
    const on = await repo.toggle(ep('a'));
    expect(on.ok && on.value).toBe(true);
    expect((await repo.isSaved('a')).ok && (await repo.isSaved('a')).ok).toBe(true);

    const off = await repo.toggle(ep('a'));
    expect(off.ok && off.value).toBe(false);
    const after = await repo.isSaved('a');
    expect(after.ok && after.value).toBe(false);
  });

  it('en son eklenen en üstte', async () => {
    const repo = make();
    await repo.toggle(ep('a'));
    await repo.toggle(ep('b'));
    const res = await repo.list();
    expect(res.ok && res.value.map(e => e.id)).toEqual(['b', 'a']);
  });
});
