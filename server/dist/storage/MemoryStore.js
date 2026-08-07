"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStore = void 0;
/**
 * MemoryStore — Store portunun bellek-içi implementasyonu.
 *
 * Testler ve native modül kurulamayan ortamlar (ör. hızlı bir deneme) için.
 * Süreç kapanınca veri kaybolur; üretimde SqliteStore kullanılır.
 */
class MemoryStore {
    users = new Map();
    sync = new Map();
    analytics = [];
    push = new Map();
    settings = new Map();
    catalog;
    async init() { }
    async findUserByDeviceId(deviceId) {
        return [...this.users.values()].find(u => u.deviceId === deviceId);
    }
    async findUserById(userId) {
        return this.users.get(userId);
    }
    async findUserByEmail(email) {
        return [...this.users.values()].find(u => u.email === email);
    }
    async createUser(user) {
        this.users.set(user.id, user);
    }
    async updateUser(userId, patch) {
        const existing = this.users.get(userId);
        if (existing) {
            // undefined alanlar mevcut değeri korur (kısmi güncelleme).
            const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
            this.users.set(userId, { ...existing, ...defined });
        }
    }
    async listSyncRecords(userId, collection, since) {
        const prefix = `${userId}:${collection}:`;
        return [...this.sync.entries()]
            .filter(([k, v]) => k.startsWith(prefix) && v.updatedAt > since)
            .map(([, v]) => v)
            .sort((a, b) => a.updatedAt - b.updatedAt);
    }
    async upsertSyncRecords(userId, collection, records) {
        for (const r of records) {
            const key = `${userId}:${collection}:${r.key}`;
            const existing = this.sync.get(key);
            // Son yazan kazanır — eski veri yenisini ezmez.
            if (!existing || r.updatedAt > existing.updatedAt) {
                this.sync.set(key, r);
            }
        }
    }
    async appendAnalytics(events) {
        this.analytics.push(...events);
    }
    async upsertPushRegistration(registration) {
        this.push.set(registration.token, registration);
    }
    async removePushRegistration(token) {
        this.push.delete(token);
    }
    async listPushTargetsForShow(showId) {
        // Takip kaydı olan (silinmemiş) kullanıcıların push jetonları.
        const followers = new Set([...this.sync.entries()]
            .filter(([key, value]) => key.includes(':follows:') && value.key === showId && !value.deleted)
            .map(([key]) => key.split(':')[0]));
        return [...this.push.values()].filter(p => followers.has(p.userId));
    }
    async getSetting(key) {
        return this.settings.get(key);
    }
    async setSetting(key, value) {
        this.settings.set(key, value);
    }
    async getCatalog() {
        return this.catalog;
    }
    async setCatalog(json) {
        this.catalog = json;
    }
    async close() { }
    /** Test yardımcıları — üretim kodu bunları kullanmaz. */
    get analyticsCount() {
        return this.analytics.length;
    }
    get pushCount() {
        return this.push.size;
    }
}
exports.MemoryStore = MemoryStore;
//# sourceMappingURL=MemoryStore.js.map