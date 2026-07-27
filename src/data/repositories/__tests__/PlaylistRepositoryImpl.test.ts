import { InMemoryKeyValueStorage } from '@infrastructure';
import { Episode, SAVED_PLAYLIST_ID } from '@domain/entities';
import { PlaylistRepositoryImpl } from '../PlaylistRepositoryImpl';

const episode = (id: string): Episode => ({
  id,
  showId: 'sov-1',
  title: `Bölüm ${id}`,
  description: '',
  audioUrl: `https://media/${id}.mp3`,
  durationSec: 100,
  publishedAt: '2026-07-01',
});

const make = () => {
  const storage = new InMemoryKeyValueStorage();
  return { storage, repo: new PlaylistRepositoryImpl(storage) };
};

describe('PlaylistRepositoryImpl', () => {
  it('"Sonra dinle" sistem listesi her zaman vardır', async () => {
    const { repo } = make();
    const result = await repo.list();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = result.value.find(p => p.id === SAVED_PLAYLIST_ID);
    expect(saved?.system).toBe(true);
    expect(saved?.name).toBe('Sonra dinle');
  });

  it('liste oluşturur ve listeler', async () => {
    const { repo } = make();
    const created = await repo.create({ name: 'Sabah' });
    expect(created.ok).toBe(true);

    const all = await repo.list();
    expect(all.ok && all.value.some(p => p.name === 'Sabah')).toBe(true);
  });

  it('adı boş liste oluşturulamaz', async () => {
    const { repo } = make();
    const result = await repo.create({ name: '   ' });
    expect(result.ok).toBe(false);
  });

  it('bölüm ekler ve çıkarır', async () => {
    const { repo } = make();
    const created = await repo.create({ name: 'Liste' });
    if (!created.ok) throw new Error('oluşturulamadı');
    const id = created.value.id;

    const added = await repo.addEpisode(id, episode('e1'));
    expect(added.ok && added.value.episodes).toHaveLength(1);

    const removed = await repo.removeEpisode(id, 'e1');
    expect(removed.ok && removed.value.episodes).toHaveLength(0);
  });

  it('aynı bölüm iki kez eklenmez', async () => {
    const { repo } = make();
    const created = await repo.create({ name: 'Liste' });
    if (!created.ok) throw new Error('oluşturulamadı');

    await repo.addEpisode(created.value.id, episode('e1'));
    const again = await repo.addEpisode(created.value.id, episode('e1'));
    expect(again.ok && again.value.episodes).toHaveLength(1);
  });

  it('sistem listesi silinemez', async () => {
    const { repo } = make();
    const result = await repo.remove(SAVED_PLAYLIST_ID);
    expect(result.ok).toBe(false);
  });

  it('kullanıcı listesi silinebilir', async () => {
    const { repo } = make();
    const created = await repo.create({ name: 'Geçici' });
    if (!created.ok) throw new Error('oluşturulamadı');

    expect((await repo.remove(created.value.id)).ok).toBe(true);
    const after = await repo.get(created.value.id);
    expect(after.ok && after.value).toBeNull();
  });

  it('liste adı ve kapağı güncellenir', async () => {
    const { repo } = make();
    const created = await repo.create({ name: 'Eski' });
    if (!created.ok) throw new Error('oluşturulamadı');

    const updated = await repo.update(created.value.id, {
      name: 'Yeni',
      coverUri: 'file:///kapak.jpg',
    });
    expect(updated.ok && updated.value.name).toBe('Yeni');
    expect(updated.ok && updated.value.coverUri).toBe('file:///kapak.jpg');
  });

  it('sistem listesinin adı değiştirilemez (kapağı değişebilir)', async () => {
    const { repo } = make();
    const updated = await repo.update(SAVED_PLAYLIST_ID, {
      name: 'Başka ad',
      coverUri: 'file:///k.jpg',
    });
    expect(updated.ok && updated.value.name).toBe('Sonra dinle');
    expect(updated.ok && updated.value.coverUri).toBe('file:///k.jpg');
  });

  it('eski "sonra dinle" verisini sistem listesine taşır', async () => {
    const { storage } = make();
    // Önceki sürümün deposu.
    storage.set('saved_episodes_v1', JSON.stringify([episode('eski-1'), episode('eski-2')]));

    const repo = new PlaylistRepositoryImpl(storage);
    const saved = await repo.get(SAVED_PLAYLIST_ID);
    expect(saved.ok && saved.value?.episodes).toHaveLength(2);
  });

  it('bozuk kayıt tüm listeleri düşürmez', async () => {
    const { storage } = make();
    storage.set('playlists_v1', '{bozuk json');

    const repo = new PlaylistRepositoryImpl(storage);
    const all = await repo.list();
    expect(all.ok).toBe(true);
    // Sistem listesi yine oluşturulur.
    expect(all.ok && all.value.some(p => p.id === SAVED_PLAYLIST_ID)).toBe(true);
  });
});
