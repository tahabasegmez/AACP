import { MemoryStore } from '../../../storage/MemoryStore';
import { SyncService } from '../SyncService';

const makeSut = () => {
  const store = new MemoryStore();
  return { store, sync: new SyncService(store) };
};

const record = (key: string, updatedAt: number, value = '{}', deleted = false) => ({
  key,
  value,
  updatedAt,
  deleted,
});

describe('SyncService', () => {
  it('gönderilen kayıtları saklar ve delta olarak geri verir', async () => {
    const { sync } = makeSut();
    await sync.push('u1', 'progress', [record('ep1', 1000), record('ep2', 2000)]);

    const result = await sync.pull('u1', 'progress', 0);
    expect(result.records).toHaveLength(2);
    expect(result.cursor).toBe(2000);
  });

  it('since sonrası yalnızca değişenleri döner', async () => {
    const { sync } = makeSut();
    await sync.push('u1', 'progress', [record('ep1', 1000), record('ep2', 3000)]);

    const result = await sync.pull('u1', 'progress', 2000);
    expect(result.records.map(r => r.key)).toEqual(['ep2']);
  });

  it('eski kayıt daha yeni sunucu kaydını ezmez (son yazan kazanır)', async () => {
    const { sync } = makeSut();
    await sync.push('u1', 'progress', [record('ep1', 5000, '{"pos":50}')]);
    await sync.push('u1', 'progress', [record('ep1', 1000, '{"pos":10}')]);

    const result = await sync.pull('u1', 'progress', 0);
    expect(result.records[0].value).toBe('{"pos":50}');
  });

  it('silme (tombstone) senkronlanır', async () => {
    const { sync } = makeSut();
    await sync.push('u1', 'saved', [record('ep1', 1000)]);
    await sync.push('u1', 'saved', [record('ep1', 2000, '{}', true)]);

    const result = await sync.pull('u1', 'saved', 0);
    expect(result.records[0].deleted).toBe(true);
  });

  it('kullanıcılar birbirinin verisini görmez', async () => {
    const { sync } = makeSut();
    await sync.push('u1', 'follows', [record('show1', 1000)]);

    const other = await sync.pull('u2', 'follows', 0);
    expect(other.records).toHaveLength(0);
  });

  it('bilinmeyen koleksiyonu reddeder', async () => {
    const { sync } = makeSut();
    await expect(sync.pull('u1', 'gizli', 0)).rejects.toThrow(/Bilinmeyen koleksiyon/);
  });

  it('geçersiz kayıtları reddeder', async () => {
    const { sync } = makeSut();
    await expect(sync.push('u1', 'progress', [{ key: '', updatedAt: 1 }])).rejects.toThrow(
      /key zorunlu/,
    );
    await expect(sync.push('u1', 'progress', [{ key: 'a', updatedAt: 0 }])).rejects.toThrow(
      /updatedAt/,
    );
  });
});
