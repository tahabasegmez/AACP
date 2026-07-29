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

  describe('moveItem (sürükle-bırak sıralama)', () => {
    it('öğeyi aşağı taşır', () => {
      state().setQueue([episode('a'), episode('b'), episode('c')], 0);
      state().moveItem(1, 2);

      expect(state().episodes.map(e => e.id)).toEqual(['a', 'c', 'b']);
    });

    it('öğeyi yukarı taşır', () => {
      state().setQueue([episode('a'), episode('b'), episode('c')], 0);
      state().moveItem(2, 1);

      expect(state().episodes.map(e => e.id)).toEqual(['a', 'c', 'b']);
    });

    it('ÇALAN bölüm taşınırsa indeks onu takip eder', () => {
      state().setQueue([episode('a'), episode('b'), episode('c')], 0);
      state().moveItem(0, 2);

      expect(state().episodes.map(e => e.id)).toEqual(['b', 'c', 'a']);
      expect(state().index).toBe(2); // hâlâ 'a' çalıyor
    });

    it('çalanın ÜSTÜNDEN altına taşımada indeks bir azalır', () => {
      state().setQueue([episode('a'), episode('b'), episode('c')], 1);
      state().moveItem(0, 2); // 'a' aşağı indi, 'b' bir üste kaydı

      expect(state().episodes.map(e => e.id)).toEqual(['b', 'c', 'a']);
      expect(state().index).toBe(0); // hâlâ 'b' çalıyor
    });

    it('çalanın ALTINDAN üstüne taşımada indeks bir artar', () => {
      state().setQueue([episode('a'), episode('b'), episode('c')], 1);
      state().moveItem(2, 0); // 'c' başa geldi, 'b' bir alta kaydı

      expect(state().episodes.map(e => e.id)).toEqual(['c', 'a', 'b']);
      expect(state().index).toBe(2); // hâlâ 'b' çalıyor
    });

    it('aynı konuma taşıma kuyruğu değiştirmez', () => {
      state().setQueue([episode('a'), episode('b')], 0);
      state().moveItem(1, 1);

      expect(state().episodes.map(e => e.id)).toEqual(['a', 'b']);
    });

    it('sınır dışı konumlar yok sayılır', () => {
      state().setQueue([episode('a'), episode('b')], 0);
      state().moveItem(0, 9);
      state().moveItem(-1, 1);

      expect(state().episodes.map(e => e.id)).toEqual(['a', 'b']);
    });
  });
});
