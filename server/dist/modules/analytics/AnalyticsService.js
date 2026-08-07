"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const errors_1 = require("../../core/errors");
/** Tek istekte kabul edilen en fazla olay. */
const MAX_EVENTS = 200;
/** Kabul edilen olay adları — açık liste (şema kayması olmasın). */
const ALLOWED_EVENTS = new Set([
    'app_open',
    'screen_view',
    'episode_play',
    'episode_complete',
    'episode_download',
    'show_follow',
    'search',
    'error',
]);
/**
 * AnalyticsService — kullanım telemetrisini toplar.
 *
 * Gizlilik: olaylar cihaz kullanıcısına bağlıdır (anonim UUID), kişisel veri
 * içermez. Olay adları açık listeyle sınırlıdır; yük (payload) serbest JSON
 * olsa da boyutu sınırlandırılır.
 */
class AnalyticsService {
    store;
    enabled;
    constructor(store, enabled) {
        this.store = store;
        this.enabled = enabled;
    }
    async ingest(userId, raw) {
        if (!this.enabled) {
            return { accepted: 0 }; // toplama kapalıysa sessizce yok say
        }
        if (!Array.isArray(raw)) {
            throw errors_1.HttpError.badRequest('events bir dizi olmalı');
        }
        if (raw.length > MAX_EVENTS) {
            throw errors_1.HttpError.badRequest(`Tek istekte en fazla ${MAX_EVENTS} olay gönderilebilir`);
        }
        const events = [];
        for (const item of raw) {
            if (typeof item !== 'object' || item === null) {
                continue;
            }
            const o = item;
            const name = typeof o.name === 'string' ? o.name.trim() : '';
            if (!ALLOWED_EVENTS.has(name)) {
                continue; // bilinmeyen olay sessizce atlanır
            }
            const occurredAt = Number(o.occurredAt);
            events.push({
                userId,
                name,
                payload: truncate(JSON.stringify(o.payload ?? {}), 2000),
                occurredAt: Number.isFinite(occurredAt) && occurredAt > 0 ? Math.floor(occurredAt) : Date.now(),
            });
        }
        if (events.length > 0) {
            await this.store.appendAnalytics(events);
        }
        return { accepted: events.length };
    }
}
exports.AnalyticsService = AnalyticsService;
const truncate = (value, max) => value.length <= max ? value : `${value.slice(0, max)}…`;
//# sourceMappingURL=AnalyticsService.js.map