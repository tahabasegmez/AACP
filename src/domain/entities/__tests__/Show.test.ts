import { Show, mergeShow } from '../Show';

const base: Show = {
  id: 'x',
  title: 'Feed Başlık',
  description: 'Feed açıklama',
  author: 'Anadolu Ajansı',
  imageUrl: 'https://feed/image.jpg',
  feedUrl: 'https://feeds/x',
  language: 'tr',
  categories: ['News'],
  websiteUrl: 'https://aa.com.tr',
};

const fallback: Show = {
  id: 'x',
  title: 'Katalog Başlık',
  description: 'Katalog açıklama',
  author: '',
  imageUrl: 'https://catalog/image.jpg',
  feedUrl: 'https://feeds/x',
  language: 'tr',
  categories: ['Fallback'],
};

describe('mergeShow', () => {
  it('primary dolu alanları korur', () => {
    const m = mergeShow(base, fallback);
    expect(m.title).toBe('Feed Başlık');
    expect(m.imageUrl).toBe('https://feed/image.jpg');
    expect(m.categories).toEqual(['News']);
  });

  it('primary boş alanları fallback ile doldurur', () => {
    const m = mergeShow(
      { ...base, description: '', imageUrl: undefined, categories: [] },
      fallback,
    );
    expect(m.description).toBe('Katalog açıklama');
    expect(m.imageUrl).toBe('https://catalog/image.jpg');
    expect(m.categories).toEqual(['Fallback']);
  });

  it('fallback yoksa primary aynen döner', () => {
    expect(mergeShow(base)).toEqual(base);
  });
});
