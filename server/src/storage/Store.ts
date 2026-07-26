/**
 * Store — kalıcılık PORTU.
 *
 * Servis katmanı yalnızca bu arayüzü görür; SQLite mi Postgres mi olduğunu
 * bilmez. Bugün tek dosyalık SQLite yeterli (Raspberry Pi dahil her yerde
 * çalışır); yük artarsa `PostgresStore` yazıp DI'da değiştirmek yeterlidir.
 */

/** Bir kullanıcının senkronlanan kaydı (son-yazan-kazanır çözümü için zaman damgalı). */
export interface SyncRecord {
  /** Koleksiyon içinde benzersiz anahtar (ör. episodeId, showId). */
  readonly key: string;
  /** Serileştirilmiş yük (JSON). */
  readonly value: string;
  /** İstemcideki son değişiklik zamanı (epoch ms) — çakışma çözümü. */
  readonly updatedAt: number;
  /** Kayıt silindi mi (tombstone) — silmeler de senkronlanmalı. */
  readonly deleted: boolean;
}

export interface AnalyticsEvent {
  readonly userId?: string;
  readonly name: string;
  readonly payload: string;
  readonly occurredAt: number;
}

export interface PushRegistration {
  readonly userId: string;
  readonly token: string;
  readonly platform: string;
  readonly updatedAt: number;
}

export interface UserRecord {
  readonly id: string;
  /** Anonim cihaz kullanıcıları için cihaz kimliği; hesaplı kullanıcılarda null. */
  readonly deviceId?: string;
  readonly createdAt: number;
}

export interface Store {
  /** Şema kurulumu / göç. Uygulama başlarken bir kez çağrılır. */
  init(): Promise<void>;

  // --- kullanıcılar -------------------------------------------------------
  findUserByDeviceId(deviceId: string): Promise<UserRecord | undefined>;
  createUser(user: UserRecord): Promise<void>;

  // --- senkron ------------------------------------------------------------
  /** Belirtilen zamandan SONRA değişmiş kayıtları döner (delta senkron). */
  listSyncRecords(
    userId: string,
    collection: string,
    since: number,
  ): Promise<SyncRecord[]>;
  /**
   * Kayıtları birleştirir. Aynı anahtarda sunucudaki kayıt daha yeniyse
   * (updatedAt büyükse) istemci kaydı YOK SAYILIR — son yazan kazanır.
   */
  upsertSyncRecords(
    userId: string,
    collection: string,
    records: readonly SyncRecord[],
  ): Promise<void>;

  // --- telemetri ----------------------------------------------------------
  appendAnalytics(events: readonly AnalyticsEvent[]): Promise<void>;

  // --- push ---------------------------------------------------------------
  upsertPushRegistration(registration: PushRegistration): Promise<void>;
  removePushRegistration(token: string): Promise<void>;

  // --- katalog ------------------------------------------------------------
  /** Yayınlanmış katalog JSON'u (yoksa undefined → bundled fallback). */
  getCatalog(): Promise<string | undefined>;
  setCatalog(json: string): Promise<void>;

  close(): Promise<void>;
}
