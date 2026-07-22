import { paginate } from '../Page';

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5];

  it('ilk sayfayı döner ve hasMore hesaplar', () => {
    const p = paginate(items, 2, 0);
    expect(p.items).toEqual([1, 2]);
    expect(p.total).toBe(5);
    expect(p.hasMore).toBe(true);
  });

  it('son sayfada hasMore=false', () => {
    const p = paginate(items, 2, 4);
    expect(p.items).toEqual([5]);
    expect(p.hasMore).toBe(false);
  });

  it('offset taşarsa boş döner', () => {
    const p = paginate(items, 2, 10);
    expect(p.items).toEqual([]);
    expect(p.hasMore).toBe(false);
  });

  it('negatif değerleri güvenle kırpar', () => {
    const p = paginate(items, -2, -5);
    expect(p.offset).toBe(0);
    expect(p.limit).toBe(0);
    expect(p.items).toEqual([]);
  });
});
