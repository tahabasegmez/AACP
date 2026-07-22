import { Episode, Show } from '@domain/entities';
import { episodesToItems, showsToItems } from '../sections';

const show = (over: Partial<Show>): Show => ({
  id: 's',
  title: 'Şov',
  description: '',
  author: 'AA',
  feedUrl: 'https://f',
  categories: [],
  ...over,
});

const episode = (over: Partial<Episode>): Episode => ({
  id: 'e',
  showId: 's',
  title: 'Bölüm',
  description: '',
  audioUrl: 'https://a.mp3',
  durationSec: 0,
  publishedAt: '',
  ...over,
});

describe('showsToItems', () => {
  it('başlık + açıklama (varsa) döner', () => {
    const items = showsToItems([
      show({ title: 'A', description: 'açıklama' }),
      show({ title: 'B', description: '' }),
    ]);
    expect(items).toEqual([
      { text: 'A', detailText: 'açıklama' },
      { text: 'B', detailText: undefined },
    ]);
  });
});

describe('episodesToItems', () => {
  it('başlık + biçimlenmiş süre döner', () => {
    const items = episodesToItems([episode({ title: 'Böl 1', durationSec: 90 })]);
    expect(items).toEqual([{ text: 'Böl 1', detailText: '1:30' }]);
  });
});
