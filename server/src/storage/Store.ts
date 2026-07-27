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
  /**
   * Cihaz kimliği (anonim giriş için). Kullanıcı hesap oluşturduğunda da
   * KORUNUR: aynı kayıt e-posta ile zenginleşir, veri taşınması gerekmez.
   */
  readonly deviceId?: string;
  /** Hesap bağlandıysa e-posta (normalize: küçük harf, kırpılmış). */
  readonly email?: string;
  /** Şifre doğrulaması için `salt:hash` (scrypt). Anonim kullanıcıda yok. */
  readonly passwordHash?: string;
  readonly displayName?: string;
  readonly createdAt: number;
}

export interface Store {
  /** Şema kurulumu / göç. Uygulama başlarken bir kez çağrılır. */
  init(): Promise<void>;

  // --- kullanıcılar -------------------------------------------------------
  findUserByDeviceId(deviceId: string): Promise<UserRecord | undefined>;
  findUserById(userId: string): Promise<UserRecord | undefined>;
  /** E-posta ile arama (giriş ve "bu e-posta alınmış mı" kontrolü). */
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  createUser(user: UserRecord): Promise<void>;
  /** Verilen alanları günceller (hesap bağlama, profil düzenleme). */
  updateUser(
    userId: string,
    patch: Partial<Pick<UserRecord, 'email' | 'passwordHash' | 'displayName' | 'deviceId'>>,
  ): Promise<void>;

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
  /**
   * Bir şovu takip eden kullanıcıların push kayıtları.
   * (follows koleksiyonunda `key = showId` ve silinmemiş olanlar.)
   */
  listPushTargetsForShow(showId: string): Promise<PushRegistration[]>;

  // --- anahtar/değer (servis durumu) --------------------------------------
  /** Serbest ayar okuma/yazma (ör. bir şovun en son görülen bölümü). */
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;

  // --- katalog ------------------------------------------------------------
  /** Yayınlanmış katalog JSON'u (yoksa undefined → bundled fallback). */
  getCatalog(): Promise<string | undefined>;
  setCatalog(json: string): Promise<void>;

  close(): Promise<void>;
}
