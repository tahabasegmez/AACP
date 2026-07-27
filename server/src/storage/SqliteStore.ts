import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type {
  AnalyticsEvent,
  PushRegistration,
  Store,
  SyncRecord,
  UserRecord,
} from './Store';

/**
 * SqliteStore — Store portunun tek dosyalık SQLite implementasyonu.
 *
 * Neden SQLite: harici bir veritabanı süreci gerektirmez, tek dosyadır
 * (yedeklemesi kopyalamak kadar kolay) ve ARM (Raspberry Pi) dahil her yerde
 * çalışır. Yük büyüdüğünde `Store` portunu implement eden bir Postgres
 * adaptörü yazmak yeterlidir; servis katmanı değişmez.
 *
 * WAL modu açıktır: okuma ve yazma birbirini bloklamaz.
 */
/** `users` tablosunun ham satır şekli. */
interface UserRow {
  id: string;
  device_id: string | null;
  email: string | null;
  password_hash: string | null;
  display_name: string | null;
  created_at: number;
}

export class SqliteStore implements Store {
  private readonly db: Database.Database;

  constructor(dataDir: string, fileName = 'aacp.db') {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, fileName));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id         TEXT PRIMARY KEY,
        device_id  TEXT UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_records (
        user_id    TEXT NOT NULL,
        collection TEXT NOT NULL,
        key        TEXT NOT NULL,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, collection, key)
      );
      CREATE INDEX IF NOT EXISTS idx_sync_delta
        ON sync_records (user_id, collection, updated_at);

      CREATE TABLE IF NOT EXISTS analytics_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT,
        name        TEXT NOT NULL,
        payload     TEXT NOT NULL,
        occurred_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_time
        ON analytics_events (occurred_at);

      CREATE TABLE IF NOT EXISTS push_registrations (
        token      TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        platform   TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    this.migrate();
  }

  /**
   * Şema göçleri — var olan kurulumları bozmadan sütun ekler.
   *
   * `CREATE TABLE IF NOT EXISTS` yalnızca yeni kurulumları kapsar; çalışan bir
   * sunucuda tablo zaten vardır ve yeni sütunlar eklenmez. Bu yüzden eksik
   * sütunlar burada tek tek kontrol edilip eklenir. Adım eklemek = diziye bir
   * satır eklemek.
   */
  private migrate(): void {
    const columns = (table: string): Set<string> =>
      new Set(
        (this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
          c => c.name,
        ),
      );

    const userColumns = columns('users');
    const userMigrations: Array<[string, string]> = [
      ['email', 'ALTER TABLE users ADD COLUMN email TEXT'],
      ['password_hash', 'ALTER TABLE users ADD COLUMN password_hash TEXT'],
      ['display_name', 'ALTER TABLE users ADD COLUMN display_name TEXT'],
    ];
    for (const [column, sql] of userMigrations) {
      if (!userColumns.has(column)) {
        this.db.exec(sql);
      }
    }

    // E-posta benzersiz olmalı ama NULL'lar serbest (anonim kullanıcılar).
    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL',
    );
  }

  /** Satırı domain kaydına çevirir (null → undefined). */
  private toUser(row: UserRow): UserRecord {
    return {
      id: row.id,
      deviceId: row.device_id ?? undefined,
      email: row.email ?? undefined,
      passwordHash: row.password_hash ?? undefined,
      displayName: row.display_name ?? undefined,
      createdAt: row.created_at,
    };
  }

  private selectUser(where: string, param: string): UserRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT id, device_id, email, password_hash, display_name, created_at
           FROM users WHERE ${where} = ?`,
      )
      .get(param) as UserRow | undefined;
    return row ? this.toUser(row) : undefined;
  }

  async findUserByDeviceId(deviceId: string): Promise<UserRecord | undefined> {
    return this.selectUser('device_id', deviceId);
  }

  async findUserById(userId: string): Promise<UserRecord | undefined> {
    return this.selectUser('id', userId);
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    return this.selectUser('email', email);
  }

  async createUser(user: UserRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO users (id, device_id, email, password_hash, display_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id,
        user.deviceId ?? null,
        user.email ?? null,
        user.passwordHash ?? null,
        user.displayName ?? null,
        user.createdAt,
      );
  }

  async updateUser(
    userId: string,
    patch: Partial<Pick<UserRecord, 'email' | 'passwordHash' | 'displayName' | 'deviceId'>>,
  ): Promise<void> {
    const columnOf: Record<string, string> = {
      email: 'email',
      passwordHash: 'password_hash',
      displayName: 'display_name',
      deviceId: 'device_id',
    };
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return;
    }
    const assignments = entries.map(([key]) => `${columnOf[key]} = ?`).join(', ');
    this.db
      .prepare(`UPDATE users SET ${assignments} WHERE id = ?`)
      .run(...entries.map(([, value]) => value), userId);
  }

  async listSyncRecords(
    userId: string,
    collection: string,
    since: number,
  ): Promise<SyncRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT key, value, updated_at, deleted FROM sync_records
         WHERE user_id = ? AND collection = ? AND updated_at > ?
         ORDER BY updated_at ASC`,
      )
      .all(userId, collection, since) as Array<{
      key: string;
      value: string;
      updated_at: number;
      deleted: number;
    }>;
    return rows.map(r => ({
      key: r.key,
      value: r.value,
      updatedAt: r.updated_at,
      deleted: r.deleted === 1,
    }));
  }

  async upsertSyncRecords(
    userId: string,
    collection: string,
    records: readonly SyncRecord[],
  ): Promise<void> {
    // `WHERE excluded.updated_at > sync_records.updated_at` → son yazan kazanır;
    // gecikmiş (eski) istemci verisi daha yeni sunucu kaydını ezmez.
    const stmt = this.db.prepare(
      `INSERT INTO sync_records (user_id, collection, key, value, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, collection, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at,
         deleted = excluded.deleted
       WHERE excluded.updated_at > sync_records.updated_at`,
    );
    const tx = this.db.transaction((items: readonly SyncRecord[]) => {
      for (const r of items) {
        stmt.run(userId, collection, r.key, r.value, r.updatedAt, r.deleted ? 1 : 0);
      }
    });
    tx(records);
  }

  async appendAnalytics(events: readonly AnalyticsEvent[]): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO analytics_events (user_id, name, payload, occurred_at) VALUES (?, ?, ?, ?)',
    );
    const tx = this.db.transaction((items: readonly AnalyticsEvent[]) => {
      for (const e of items) {
        stmt.run(e.userId ?? null, e.name, e.payload, e.occurredAt);
      }
    });
    tx(events);
  }

  async upsertPushRegistration(registration: PushRegistration): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO push_registrations (token, user_id, platform, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (token) DO UPDATE SET
           user_id = excluded.user_id,
           platform = excluded.platform,
           updated_at = excluded.updated_at`,
      )
      .run(registration.token, registration.userId, registration.platform, registration.updatedAt);
  }

  async removePushRegistration(token: string): Promise<void> {
    this.db.prepare('DELETE FROM push_registrations WHERE token = ?').run(token);
  }

  async listPushTargetsForShow(showId: string): Promise<PushRegistration[]> {
    // Takip kaydı `sync_records`'ta collection='follows', key=showId olarak durur;
    // silinmiş (tombstone) kayıtlar hariç tutulur.
    const rows = this.db
      .prepare(
        `SELECT p.token, p.user_id, p.platform, p.updated_at
           FROM push_registrations p
           JOIN sync_records s
             ON s.user_id = p.user_id
            AND s.collection = 'follows'
            AND s.key = ?
            AND s.deleted = 0`,
      )
      .all(showId) as Array<{
      token: string;
      user_id: string;
      platform: string;
      updated_at: number;
    }>;
    return rows.map(r => ({
      token: r.token,
      userId: r.user_id,
      platform: r.platform,
      updatedAt: r.updated_at,
    }));
  }

  async getSetting(key: string): Promise<string | undefined> {
    const row = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  async getCatalog(): Promise<string | undefined> {
    return this.getSetting('catalog');
  }

  async setCatalog(json: string): Promise<void> {
    await this.setSetting('catalog', json);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
