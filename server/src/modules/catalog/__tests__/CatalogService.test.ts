import { MemoryStore } from '../../../storage/MemoryStore';
import { CatalogService, normalizeCatalog } from '../CatalogService';

const entry = (slug: string) => ({
  slug,
  feedUrl: `https://feeds.example.com/${slug}`,
  title: `Şov ${slug}`,
});

describe('normalizeCatalog', () => {
  it('geçersiz girişleri atlar, geçerlileri korur', () => {
    const result = normalizeCatalog([
      entry('a'),
      { slug: 'eksik' }, // feedUrl/title yok
      null,
      entry('b'),
    ]);
    expect(result.map(e => e.slug)).toEqual(['a', 'b']);
  });

  it('yinelenen slug\'ı tekilleştirir', () => {
    const result = normalizeCatalog([entry('a'), entry('a')]);
    expect(result).toHaveLength(1);
  });

  it('dizi olmayan veriyi reddeder', () => {
    expect(() => normalizeCatalog({ slug: 'a' })).toThrow(/dizi/);
  });
});

describe('CatalogService', () => {
  const makeSut = () => {
    const store = new MemoryStore();
    return { store, catalog: new CatalogService(store, './__not_exists__') };
  };

  it('yayınlanan kataloğu geri döner', async () => {
    const { catalog } = makeSut();
    await catalog.publish([entry('a'), entry('b')]);
    const result = await catalog.get();
    expect(result.map(e => e.slug)).toEqual(['a', 'b']);
  });

  it('boş katalog yayınlamayı reddeder', async () => {
    const { catalog } = makeSut();
    await expect(catalog.publish([])).rejects.toThrow(/boş olamaz/);
  });

  it('hiç katalog yoksa boş dizi döner (uygulama bundled fallback kullanır)', async () => {
    const { catalog } = makeSut();
    expect(await catalog.get()).toEqual([]);
  });
});
