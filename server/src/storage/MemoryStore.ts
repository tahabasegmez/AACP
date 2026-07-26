import type {
  AnalyticsEvent,
  PushRegistration,
  Store,
  SyncRecord,
  UserRecord,
} from './Store';

/**
 * MemoryStore — Store portunun bellek-içi implementasyonu.
 *
 * Testler ve native modül kurulamayan ortamlar (ör. hızlı bir deneme) için.
 * Süreç kapanınca veri kaybolur; üretimde SqliteStore kullanılır.
 */
export class MemoryStore implements Store {
  private readonly users = new Map<string, UserRecord>();
  private readonly sync = new Map<string, SyncRecord>();
  private readonly analytics: AnalyticsEvent[] = [];
  private readonly push = new Map<string, PushRegistration>();
  private catalog?: string;

  async init(): Promise<void> {}

  async findUserByDeviceId(deviceId: string): Promise<UserRecord | undefined> {
    return [...this.users.values()].find(u => u.deviceId === deviceId);
  }

  async createUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, user);
  }

  async listSyncRecords(
    userId: string,
    collection: string,
    since: number,
  ): Promise<SyncRecord[]> {
    const prefix = `${userId}:${collection}:`;
    return [...this.sync.entries()]
      .filter(([k, v]) => k.startsWith(prefix) && v.updatedAt > since)
      .map(([, v]) => v)
      .sort((a, b) => a.updatedAt - b.updatedAt);
  }

  async upsertSyncRecords(
    userId: string,
    collection: string,
    records: readonly SyncRecord[],
  ): Promise<void> {
    for (const r of records) {
      const key = `${userId}:${collection}:${r.key}`;
      const existing = this.sync.get(key);
      // Son yazan kazanır — eski veri yenisini ezmez.
      if (!existing || r.updatedAt > existing.updatedAt) {
        this.sync.set(key, r);
      }
    }
  }

  async appendAnalytics(events: readonly AnalyticsEvent[]): Promise<void> {
    this.analytics.push(...events);
  }

  async upsertPushRegistration(registration: PushRegistration): Promise<void> {
    this.push.set(registration.token, registration);
  }

  async removePushRegistration(token: string): Promise<void> {
    this.push.delete(token);
  }

  async getCatalog(): Promise<string | undefined> {
    return this.catalog;
  }

  async setCatalog(json: string): Promise<void> {
    this.catalog = json;
  }

  async close(): Promise<void> {}

  /** Test yardımcıları — üretim kodu bunları kullanmaz. */
  get analyticsCount(): number {
    return this.analytics.length;
  }
  get pushCount(): number {
    return this.push.size;
  }
}
