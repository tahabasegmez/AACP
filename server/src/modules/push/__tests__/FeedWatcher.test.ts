import { silentLogger } from '../../../core/logger';
import { MemoryStore } from '../../../storage/MemoryStore';
import { CatalogService } from '../../catalog/CatalogService';
import { FeedWatcher } from '../FeedWatcher';
import type { PushMessage, PushSender } from '../PushSender';

/** Gönderilen bildirimleri toplayan sahte gönderici. */
class FakeSender implements PushSender {
  enabled = true;
  sentMessages: PushMessage[] = [];
  async send(messages: readonly PushMessage[]) {
    this.sentMessages.push(...messages);
    return { sent: messages.length, failed: 0 };
  }
}

const rss = (guid: string, title: string): string => `<?xml version="1.0"?>
<rss><channel>
  <title>Şov</title>
  <item>
    <title><![CDATA[${title}]]></title>
    <guid isPermaLink="false">${guid}</guid>
  </item>
  <item><title>Eski</title><guid>eski-1</guid></item>
</channel></rss>`;

/** fetch'i sahte RSS döndürecek şekilde değiştirir. */
const mockFeed = (xml: string): void => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => xml,
  }) as unknown as typeof fetch;
};

const makeSut = async () => {
  const store = new MemoryStore();
  const catalog = new CatalogService(store, './__not_exists__');
  await catalog.publish([
    { slug: 'sov-a', feedUrl: 'https://feeds.example.com/sov-a', title: 'Şov A' },
  ]);
  const sender = new FakeSender();
  const watcher = new FeedWatcher(store, catalog, sender, silentLogger);
  return { store, sender, watcher };
};

/** Kullanıcıyı şovu takip ediyor + push jetonu kayıtlı hale getirir. */
const addFollower = async (store: MemoryStore, userId: string, showId: string) => {
  await store.upsertSyncRecords(userId, 'follows', [
    { key: showId, value: '"' + showId + '"', updatedAt: Date.now(), deleted: false },
  ]);
  await store.upsertPushRegistration({
    userId,
    token: `token-${userId}`,
    platform: 'ios',
    updatedAt: Date.now(),
  });
};

describe('FeedWatcher', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ilk taramada bildirim GÖNDERMEZ (yalnızca durumu kaydeder)', async () => {
    const { store, sender, watcher } = await makeSut();
    await addFollower(store, 'u1', 'sov-a');
    mockFeed(rss('bolum-1', 'İlk bölüm'));

    await watcher.runOnce();

    expect(sender.sentMessages).toHaveLength(0);
  });

  it('yeni bölüm çıkınca takipçilere bildirim gönderir', async () => {
    const { store, sender, watcher } = await makeSut();
    await addFollower(store, 'u1', 'sov-a');

    mockFeed(rss('bolum-1', 'İlk bölüm'));
    await watcher.runOnce(); // durum kaydedilir

    mockFeed(rss('bolum-2', 'İkinci bölüm'));
    await watcher.runOnce();

    expect(sender.sentMessages).toHaveLength(1);
    expect(sender.sentMessages[0].token).toBe('token-u1');
    expect(sender.sentMessages[0].body).toContain('İkinci bölüm');
    expect(sender.sentMessages[0].data?.episodeId).toBe('bolum-2');
  });

  it('bölüm değişmediyse tekrar bildirim göndermez', async () => {
    const { store, sender, watcher } = await makeSut();
    await addFollower(store, 'u1', 'sov-a');

    mockFeed(rss('bolum-1', 'İlk bölüm'));
    await watcher.runOnce();
    mockFeed(rss('bolum-2', 'İkinci bölüm'));
    await watcher.runOnce();
    await watcher.runOnce(); // aynı bölüm — sessiz kalmalı

    expect(sender.sentMessages).toHaveLength(1);
  });

  it('takip etmeyen kullanıcıya bildirim gitmez', async () => {
    const { store, sender, watcher } = await makeSut();
    // Kullanıcının push jetonu var ama şovu takip etmiyor.
    await store.upsertPushRegistration({
      userId: 'u2',
      token: 'token-u2',
      platform: 'ios',
      updatedAt: Date.now(),
    });

    mockFeed(rss('bolum-1', 'İlk'));
    await watcher.runOnce();
    mockFeed(rss('bolum-2', 'İkinci'));
    await watcher.runOnce();

    expect(sender.sentMessages).toHaveLength(0);
  });

  it('takibi bırakan kullanıcıya bildirim gitmez (tombstone)', async () => {
    const { store, sender, watcher } = await makeSut();
    await addFollower(store, 'u1', 'sov-a');
    // Takibi bırak — silme kaydı daha yeni damgayla gelir.
    await store.upsertSyncRecords('u1', 'follows', [
      { key: 'sov-a', value: '', updatedAt: Date.now() + 1000, deleted: true },
    ]);

    mockFeed(rss('bolum-1', 'İlk'));
    await watcher.runOnce();
    mockFeed(rss('bolum-2', 'İkinci'));
    await watcher.runOnce();

    expect(sender.sentMessages).toHaveLength(0);
  });

  it('feed çekilemezse diğer şovlar etkilenmez', async () => {
    const { watcher } = await makeSut();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    await expect(watcher.runOnce()).resolves.toEqual({ checked: 1, notified: 0 });
  });
});
