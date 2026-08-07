"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const errors_1 = require("../../core/errors");
const password_1 = require("./password");
const tokens_1 = require("./tokens");
/** E-postayı karşılaştırmaya uygun hale getirir (küçük harf, kırpılmış). */
const normalizeEmail = (email) => (email ?? '').trim().toLowerCase();
/** Gizli alanları ayıklayıp istemciye dönülebilir profili üretir. */
const toPublicUser = (user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
});
/** Şifre için asgari uzunluk — istemcideki kuralla aynı tutulmalı. */
const MIN_PASSWORD_LENGTH = 8;
/**
 * AuthService — cihaz tabanlı anonim kimlik.
 *
 * Kullanıcıdan e-posta/şifre istemeden cihazlar arası senkronu mümkün kılar:
 * uygulama ilk açılışta rastgele bir `deviceId` üretir, sunucu buna karşılık
 * kalıcı bir kullanıcı ve imzalı bir jeton döner. İleride e-posta ile hesap
 * eklenmek istenirse aynı kullanıcı kaydına bağlanır (deviceId korunur).
 */
class AuthService {
    store;
    secret;
    tokenTtlSec;
    constructor(store, secret, tokenTtlSec) {
        this.store = store;
        this.secret = secret;
        this.tokenTtlSec = tokenTtlSec;
    }
    /** Cihaz kimliğiyle oturum açar; kullanıcı yoksa oluşturur. */
    async authenticateDevice(deviceId) {
        const trimmed = deviceId?.trim();
        if (!trimmed || trimmed.length < 8 || trimmed.length > 128) {
            throw errors_1.HttpError.badRequest('deviceId 8-128 karakter olmalı');
        }
        let user = await this.store.findUserByDeviceId(trimmed);
        if (!user) {
            user = { id: node_crypto_1.default.randomUUID(), deviceId: trimmed, createdAt: Date.now() };
            await this.store.createUser(user);
        }
        return this.sessionFor(user);
    }
    /**
     * Hesap oluşturur.
     *
     * `currentUserId` verilmişse (kullanıcı anonim olarak kullanıyorduysa) YENİ
     * kullanıcı yaratılmaz; mevcut kayıt e-posta ile YÜKSELTİLİR. Böylece
     * anonimken biriken tüm veri (kaldığın yer, takipler, listeler) hesaba
     * doğal olarak taşınır — ayrıca bir taşıma adımı gerekmez.
     */
    async register(email, password, currentUserId) {
        const normalized = normalizeEmail(email);
        this.assertCredentials(normalized, password);
        if (await this.store.findUserByEmail(normalized)) {
            throw errors_1.HttpError.badRequest('Bu e-posta zaten kayıtlı');
        }
        const passwordHash = await (0, password_1.hashPassword)(password);
        // Anonim kullanıcı varsa onu yükselt.
        if (currentUserId) {
            const existing = await this.store.findUserById(currentUserId);
            if (existing && !existing.email) {
                await this.store.updateUser(existing.id, { email: normalized, passwordHash });
                return this.sessionFor({ ...existing, email: normalized, passwordHash });
            }
        }
        const user = {
            id: node_crypto_1.default.randomUUID(),
            email: normalized,
            passwordHash,
            createdAt: Date.now(),
        };
        await this.store.createUser(user);
        return this.sessionFor(user);
    }
    /** E-posta + şifre ile giriş. */
    async signIn(email, password) {
        const normalized = normalizeEmail(email);
        const user = await this.store.findUserByEmail(normalized);
        // Kullanıcı yok ya da şifre yanlış — ikisi de AYNI mesajı döner ki
        // hangi e-postaların kayıtlı olduğu sızmasın.
        if (!user?.passwordHash || !(await (0, password_1.verifyPassword)(password, user.passwordHash))) {
            throw errors_1.HttpError.unauthorized('E-posta veya şifre hatalı');
        }
        return this.sessionFor(user);
    }
    /** Oturumdaki kullanıcının profili. */
    async profile(userId) {
        const user = await this.store.findUserById(userId);
        if (!user) {
            throw errors_1.HttpError.unauthorized('Oturum geçersiz');
        }
        return toPublicUser(user);
    }
    /** Profil günceller (şimdilik yalnızca görünen ad). */
    async updateProfile(userId, displayName) {
        const trimmed = displayName?.trim();
        if (trimmed !== undefined && trimmed.length > 60) {
            throw errors_1.HttpError.badRequest('Ad en fazla 60 karakter olabilir');
        }
        await this.store.updateUser(userId, { displayName: trimmed });
        return this.profile(userId);
    }
    assertCredentials(email, password) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw errors_1.HttpError.badRequest('Geçerli bir e-posta girin');
        }
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            throw errors_1.HttpError.badRequest(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
        }
    }
    sessionFor(user) {
        return {
            token: (0, tokens_1.createToken)(user.id, this.secret, this.tokenTtlSec),
            userId: user.id,
            expiresInSec: this.tokenTtlSec,
            user: toPublicUser(user),
        };
    }
    /** `Authorization: Bearer <token>` başlığından kullanıcı kimliğini çözer. */
    userIdFromHeader(header) {
        const value = Array.isArray(header) ? header[0] : header;
        if (!value?.toLowerCase().startsWith('bearer ')) {
            return undefined;
        }
        return (0, tokens_1.verifyToken)(value.slice(7).trim(), this.secret);
    }
    /** Kimlik zorunlu olan uçlar için: yoksa 401. */
    requireUserId(header) {
        const userId = this.userIdFromHeader(header);
        if (!userId) {
            throw errors_1.HttpError.unauthorized('Bu uç için oturum gerekli');
        }
        return userId;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map