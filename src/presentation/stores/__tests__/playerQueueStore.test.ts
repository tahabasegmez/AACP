import { Episode } from '@domain/entities';
import { usePlayerQueueStore } from '../playerQueueStore';

const episode = (id: string): Episode => ({
  id,
  showId: 'sov-1',
  title: `Bölüm ${id}`,
  description: '',
  audioUrl: `https://media/${id}.mp3`,
  durationSec: 100,
  publishedAt: '',
});

const reset = () => usePlayerQueueStore.setState({ episodes: [], index: -1 });
const state = () => usePlayerQueueStore.getState();

describe('playerQueueStore', () => {
  beforeEach(reset);

  it('enqueue bölümü kuyruğun sonuna ekler', () => {
    state().setQueue([episode('a')], 0);
    state().enqueue(episode('b'));

    expect(state().episodes.map(e => e.id)).toEqual(['a', 'b']);
  });

  it('ÇALAN bölüm tekrar sıraya eklenebilir (kopyaya izin verilir)', () => {
    // Kullanıcı çalan bölümü tekrar sıraya alabilmeli; sessizce yok sayılmamalı.
    state().setQueue([episode('a')], 0);
    state().enqueue(episode('a'));

    expect(state().episodes.map(e => e.id)).toEqual(['a', 'a']);
  });

  it('enqueueNext bölümü çalanın hemen ardına koyar', () => {
    state().setQueue([episode('a'), episode('b')], 0);
    state().enqueueNext(episode('c'));

    expect(state().episodes.map(e => e.id)).toEqual(['a', 'c', 'b']);
    expect(state().index).toBe(0); // çalan bölüm kaymadı
  });

  it('kuyruk boşken enqueueNext sona ekler', () => {
    state().enqueueNext(episode('a'));
    expect(state().episodes.map(e => e.id)).toEqual(['a']);
  });

  it('removeAt konuma göre siler', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 0);
    state().removeAt(1);

    expect(state().episodes.map(e => e.id)).toEqual(['a', 'c']);
  });

  it('çalandan ÖNCEKİ bir öğe silinince indeks kayar', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 2);
    state().removeAt(0);

    expect(state().episodes.map(e => e.id)).toEqual(['b', 'c']);
    expect(state().index).toBe(1); // hâlâ 'c' çalıyor
  });

  it('geçersiz konumda removeAt kuyruğu bozmaz', () => {
    state().setQueue([episode('a')], 0);
    state().removeAt(5);

    expect(state().episodes).toHaveLength(1);
  });
});
