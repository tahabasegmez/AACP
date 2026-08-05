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

const reset = () => usePlayerQueueStore.setState({ items: [], index: -1 });
const state = () => usePlayerQueueStore.getState();
/** Kuyruğu "kimlik:kaynak" biçiminde okunur hale getirir. */
const shape = () => state().items.map(i => `${i.episode.id}:${i.source[0]}`);
const ids = () => state().items.map(i => i.episode.id);

beforeEach(reset);

describe('setQueue', () => {
  it('bağlamı kurar ve tüm öğeleri context olarak işaretler', () => {
    state().setQueue([episode('a'), episode('b')], 0);
    expect(shape()).toEqual(['a:c', 'b:c']);
  });
});

describe('enqueue', () => {
  it('kullanıcı eklemesi bağlamın ÖNÜNE geçer', () => {
    // Asıl kural: "şunu da dinleyeyim" demek, bölümü şovun geri kalanının
    // arkasına atmak anlamına gelmemeli.
    state().setQueue([episode('a'), episode('b'), episode('c')], 0);
    state().enqueue(episode('x'));

    expect(shape()).toEqual(['a:c', 'x:u', 'b:c', 'c:c']);
  });

  it('birden çok ekleme kendi aralarında SIRAYLA dizilir', () => {
    state().setQueue([episode('a'), episode('b')], 0);
    state().enqueue(episode('x'));
    state().enqueue(episode('y'));

    expect(shape()).toEqual(['a:c', 'x:u', 'y:u', 'b:c']);
  });

  it('kuyruk boşken sona ekler', () => {
    state().enqueue(episode('x'));
    expect(shape()).toEqual(['x:u']);
  });

  it('aynı bölüm iki kez sıraya alınabilir', () => {
    // Çalan bölümü tekrar sıraya eklemek geçerli bir istektir.
    state().setQueue([episode('a')], 0);
    state().enqueue(episode('a'));
    state().enqueue(episode('a'));

    expect(ids()).toEqual(['a', 'a', 'a']);
  });

  it('çalan bölüm ilerledikçe ekleme yeni konuma göre yapılır', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 1);
    state().enqueue(episode('x'));

    expect(shape()).toEqual(['a:c', 'b:c', 'x:u', 'c:c']);
  });
});

describe('removeAt', () => {
  it('konuma göre çıkarır', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 0);
    state().removeAt(1);
    expect(ids()).toEqual(['a', 'c']);
  });

  it('çalanın önünden çıkarınca indeks kayar', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 2);
    state().removeAt(0);
    expect(state().index).toBe(1);
  });

  it('geçersiz konum yok sayılır', () => {
    state().setQueue([episode('a')], 0);
    state().removeAt(5);
    expect(state().items).toHaveLength(1);
  });
});

describe('moveItem', () => {
  it('aynı grup içinde taşır', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 0);
    state().moveItem(1, 2);
    expect(ids()).toEqual(['a', 'c', 'b']);
  });

  it('kullanıcı bloğundaki öğe bağlamın içine TAŞINAMAZ', () => {
    // İki grup birbirine karışsaydı paneldeki ayrım anlamını yitirirdi.
    state().setQueue([episode('a'), episode('b'), episode('c')], 0);
    state().enqueue(episode('x'));
    state().enqueue(episode('y'));
    // x (1) → 3 (bağlam bölgesi) denemesi kendi grubuna sıkışır.
    state().moveItem(1, 3);

    expect(shape()).toEqual(['a:c', 'y:u', 'x:u', 'b:c', 'c:c']);
  });

  it('bağlamdaki öğe kullanıcı bloğuna TAŞINAMAZ', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 0);
    state().enqueue(episode('x'));
    // b (2) → 1 (kullanıcı bloğu) denemesi kendi grubunda kalır.
    state().moveItem(2, 1);

    expect(shape()).toEqual(['a:c', 'x:u', 'b:c', 'c:c']);
  });

  it('çalan öğe taşınırsa indeks onu takip eder', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 0);
    state().moveItem(0, 2);
    expect(state().index).toBe(2);
  });

  it('çalanın önünden arkasına taşımada indeks kayar', () => {
    state().setQueue([episode('a'), episode('b'), episode('c')], 1);
    state().moveItem(0, 2);
    expect(state().index).toBe(0);
  });

  it('aynı konuma taşıma ve geçersiz sınırlar yok sayılır', () => {
    state().setQueue([episode('a'), episode('b')], 0);
    state().moveItem(1, 1);
    state().moveItem(-1, 0);
    state().moveItem(0, 9);
    expect(ids()).toEqual(['a', 'b']);
  });
});
