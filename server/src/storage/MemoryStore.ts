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
  private readonly settings = new Map<string, string>();
  private catalog?: string;

  async init(): Promise<void> {}

  async findUserByDeviceId(deviceId: string): Promise<UserRecord | undefined> {
    return [...this.users.values()].find(u => u.deviceId === deviceId);
  }

  async findUserById(userId: string): Promise<UserRecord | undefined> {
    return this.users.get(userId);
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    return [...this.users.values()].find(u => u.email === email);
  }

  async createUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, user);
  }

  async updateUser(
    userId: string,
    patch: Partial<Pick<UserRecord, 'email' | 'passwordHash' | 'displayName' | 'deviceId'>>,
  ): Promise<void> {
    const existing = this.users.get(userId);
    if (existing) {
      // undefined alanlar mevcut değeri korur (kısmi güncelleme).
      const defined = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      this.users.set(userId, { ...existing, ...defined });
    }
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

  async listPushTargetsForShow(showId: string): Promise<PushRegistration[]> {
    // Takip kaydı olan (silinmemiş) kullanıcıların push jetonları.
    const followers = new Set(
      [...this.sync.entries()]
        .filter(([key, value]) => key.includes(':follows:') && value.key === showId && !value.deleted)
        .map(([key]) => key.split(':')[0]),
    );
    return [...this.push.values()].filter(p => followers.has(p.userId));
  }

  async getSetting(key: string): Promise<string | undefined> {
    return this.settings.get(key);
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
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
