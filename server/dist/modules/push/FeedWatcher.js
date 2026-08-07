"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedWatcher = void 0;
/** Bir şovun en son görülen bölümünün saklandığı ayar anahtarı. */
const lastSeenKey = (slug) => `push.lastSeen.${slug}`;
/** Feed çekme zaman aşımı (ms). */
const FETCH_TIMEOUT_MS = 15_000;
/**
 * FeedWatcher — takip edilen şovlarda yeni bölüm çıkınca bildirim gönderir.
 *
 * Akış (şov başına):
 *   1. RSS feed'ini çek, EN SON bölümün kimliğini (guid) ve başlığını oku,
 *   2. daha önce görülenle karşılaştır — değişmemişse hiçbir şey yapma,
 *   3. yeni ise o şovu TAKİP EDEN kullanıcıların push jetonlarını bul,
 *   4. bildirimleri gönder ve yeni kimliği "görüldü" olarak kaydet.
 *
 * İlk çalıştırmada bildirim GÖNDERİLMEZ; yalnızca mevcut durum kaydedilir.
 * Aksi halde servis ilk açılışta tüm katalog için bildirim yağdırırdı.
 *
 * Gönderim `PushSender` portu üzerinden yapılır: APNs anahtarı hazır olmadan da
 * tüm zincir (tarama, eşleştirme, hedef bulma) uçtan uca çalıştırılabilir.
 */
class FeedWatcher {
    store;
    catalog;
    sender;
    logger;
    constructor(store, catalog, sender, logger) {
        this.store = store;
        this.catalog = catalog;
        this.sender = sender;
        this.logger = logger;
    }
    /** Tüm katalogu tarar. Bir şovdaki hata diğerlerini etkilemez. */
    async runOnce() {
        const shows = await this.catalog.get();
        let notified = 0;
        for (const show of shows) {
            try {
                notified += await this.checkShow(show.slug, show.feedUrl, show.title);
            }
            catch (error) {
                this.logger.warn('Feed taranamadı', { slug: show.slug, error: String(error) });
            }
        }
        return { checked: shows.length, notified };
    }
    /** Tek bir şovu kontrol eder; gönderilen bildirim sayısını döner. */
    async checkShow(slug, feedUrl, showTitle) {
        const latest = await this.fetchLatestEpisode(feedUrl);
        if (!latest) {
            return 0;
        }
        const key = lastSeenKey(slug);
        const seen = await this.store.getSetting(key);
        // Değişiklik yok → çık.
        if (seen === latest.id) {
            return 0;
        }
        // İlk kez görülüyor: durumu kaydet ama bildirim gönderme.
        if (seen === undefined) {
            await this.store.setSetting(key, latest.id);
            this.logger.info('Feed ilk kez tarandı (bildirim yok)', { slug });
            return 0;
        }
        const targets = await this.store.listPushTargetsForShow(slug);
        if (targets.length > 0 && this.sender.enabled) {
            const messages = targets.map(t => ({
                token: t.token,
                platform: t.platform,
                title: showTitle,
                body: `Yeni bölüm: ${latest.title}`,
                data: { showId: slug, episodeId: latest.id },
            }));
            const result = await this.sender.send(messages);
            this.logger.info('Yeni bölüm bildirimi', { slug, ...result });
        }
        await this.store.setSetting(key, latest.id);
        return targets.length;
    }
    /**
     * Feed'in EN SON bölümünü çözer.
     *
     * Tam bir XML ayrıştırıcı yerine hedefli bir okuma yapılır: yalnızca ilk
     * `<item>` bloğundan kimlik ve başlık alınır. Amaç "bir şey değişti mi?"
     * sorusuna cevap vermek olduğu için bu yeterlidir ve sunucuya XML bağımlılığı
     * eklemez. (Bölümlerin tam listesi zaten istemcide ayrıştırılıyor.)
     */
    async fetchLatestEpisode(feedUrl) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let xml;
        try {
            const response = await fetch(feedUrl, {
                signal: controller.signal,
                headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
            });
            if (!response.ok) {
                return undefined;
            }
            xml = await response.text();
        }
        finally {
            clearTimeout(timer);
        }
        const itemStart = xml.indexOf('<item');
        if (itemStart === -1) {
            return undefined;
        }
        const itemEnd = xml.indexOf('</item>', itemStart);
        const item = xml.slice(itemStart, itemEnd === -1 ? undefined : itemEnd);
        const title = readTag(item, 'title') ?? 'Yeni bölüm';
        // Kimlik önceliği: guid → enclosure url → pubDate. İlk bulunan kararlı sayılır.
        const id = readTag(item, 'guid') ??
            readAttribute(item, 'enclosure', 'url') ??
            readTag(item, 'pubDate');
        return id ? { id, title } : undefined;
    }
}
exports.FeedWatcher = FeedWatcher;
/** `<tag>değer</tag>` içeriğini okur (CDATA dahil), yoksa undefined. */
const readTag = (xml, tag) => {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
    if (!match) {
        return undefined;
    }
    const value = match[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .trim();
    return value.length > 0 ? value : undefined;
};
/** `<tag attr="değer" .../>` özniteliğini okur. */
const readAttribute = (xml, tag, attribute) => {
    const match = new RegExp(`<${tag}[^>]*\\b${attribute}=["']([^"']+)["']`, 'i').exec(xml);
    return match?.[1];
};
//# sourceMappingURL=FeedWatcher.js.map