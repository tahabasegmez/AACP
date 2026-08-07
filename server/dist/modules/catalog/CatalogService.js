"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCatalog = exports.CatalogService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const errors_1 = require("../../core/errors");
/**
 * CatalogService — şov kataloğunu (shows.json) yayınlar ve yönetir.
 *
 * Öncelik: veritabanındaki yayınlanmış katalog → `DATA_DIR/shows.json` dosyası
 * → boş. Böylece katalog hem yönetim ucundan (POST) hem de dosyayı sunucuya
 * kopyalayarak güncellenebilir; ikisi de aynı çıktıyı verir.
 *
 * İstemci tarafı zaten bundled bir fallback taşıdığı için sunucu erişilemese
 * bile uygulama çalışır.
 */
class CatalogService {
    store;
    dataDir;
    constructor(store, dataDir) {
        this.store = store;
        this.dataDir = dataDir;
    }
    /** Yayınlanacak katalog (JSON metni). */
    async get() {
        const stored = await this.store.getCatalog();
        if (stored) {
            return parseCatalog(stored);
        }
        const filePath = node_path_1.default.join(this.dataDir, 'shows.json');
        if (node_fs_1.default.existsSync(filePath)) {
            return parseCatalog(node_fs_1.default.readFileSync(filePath, 'utf8'));
        }
        return [];
    }
    /** Kataloğu doğrulayıp kalıcı olarak yayınlar (yönetim ucu). */
    async publish(raw) {
        const entries = (0, exports.normalizeCatalog)(raw);
        if (entries.length === 0) {
            // Boş katalog yayınlamak tüm şovları gizlerdi — kazayla olmasın diye reddedilir.
            throw errors_1.HttpError.badRequest('Katalog boş olamaz');
        }
        await this.store.setCatalog(JSON.stringify(entries));
        return { count: entries.length };
    }
}
exports.CatalogService = CatalogService;
const parseCatalog = (json) => {
    try {
        return (0, exports.normalizeCatalog)(JSON.parse(json));
    }
    catch {
        return [];
    }
};
const isNonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const optional = (v) => (isNonEmpty(v) ? v.trim() : undefined);
/**
 * Ham veriyi doğrulanmış katalog girdilerine indirger.
 * Geçersiz girişler sessizce atlanır — tek bozuk kayıt tüm listeyi düşürmez.
 */
const normalizeCatalog = (raw) => {
    if (!Array.isArray(raw)) {
        throw errors_1.HttpError.badRequest('Katalog bir dizi olmalı');
    }
    const seen = new Set();
    const out = [];
    for (const item of raw) {
        if (typeof item !== 'object' || item === null) {
            continue;
        }
        const o = item;
        if (!isNonEmpty(o.slug) || !isNonEmpty(o.feedUrl) || !isNonEmpty(o.title)) {
            continue;
        }
        const slug = o.slug.trim();
        if (seen.has(slug)) {
            continue; // yinelenen slug — ilk kayıt geçerli
        }
        seen.add(slug);
        out.push({
            slug,
            feedUrl: o.feedUrl.trim(),
            title: o.title.trim(),
            imageUrl: optional(o.imageUrl),
            description: optional(o.description),
        });
    }
    return out;
};
exports.normalizeCatalog = normalizeCatalog;
//# sourceMappingURL=CatalogService.js.map