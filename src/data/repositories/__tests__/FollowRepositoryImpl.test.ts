import { InMemoryKeyValueStorage } from '@infrastructure';
import { FollowRepositoryImpl } from '../FollowRepositoryImpl';

const make = () => new FollowRepositoryImpl(new InMemoryKeyValueStorage());

describe('FollowRepositoryImpl', () => {
  it('başlangıçta boş', async () => {
    const repo = make();
    const res = await repo.getFollowedIds();
    expect(res.ok && res.value).toEqual([]);
  });

  it('toggle takip eder ve bırakır', async () => {
    const repo = make();
    const on = await repo.toggle('s1');
    expect(on.ok && on.value).toBe(true);
    expect((await repo.isFollowed('s1')).ok && (await repo.isFollowed('s1')).ok).toBe(true);

    const off = await repo.toggle('s1');
    expect(off.ok && off.value).toBe(false);
    const after = await repo.isFollowed('s1');
    expect(after.ok && after.value).toBe(false);
  });

  it('birden çok şovu takip listesinde tutar', async () => {
    const repo = make();
    await repo.toggle('a');
    await repo.toggle('b');
    const res = await repo.getFollowedIds();
    expect(res.ok && [...res.value].sort()).toEqual(['a', 'b']);
  });
});
