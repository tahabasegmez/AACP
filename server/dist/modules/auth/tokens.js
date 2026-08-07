"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.createToken = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const errors_1 = require("../../core/errors");
const b64u = (input) => Buffer.from(input).toString('base64url');
const sign = (payload, secret) => node_crypto_1.default.createHmac('sha256', secret).update(payload).digest('base64url');
const createToken = (userId, secret, ttlSec) => {
    const payload = {
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + ttlSec,
    };
    const encoded = b64u(JSON.stringify(payload));
    return `${encoded}.${sign(encoded, secret)}`;
};
exports.createToken = createToken;
/**
 * Jetonu doğrular ve kullanıcı kimliğini döner.
 * İmza geçersiz veya süresi dolmuşsa 401 fırlatır.
 */
const verifyToken = (token, secret) => {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) {
        throw errors_1.HttpError.unauthorized('Jeton biçimi geçersiz');
    }
    const expected = sign(encoded, secret);
    // Zamanlama saldırılarına karşı sabit süreli karşılaştırma.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !node_crypto_1.default.timingSafeEqual(a, b)) {
        throw errors_1.HttpError.unauthorized('Jeton imzası geçersiz');
    }
    let payload;
    try {
        payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    }
    catch {
        throw errors_1.HttpError.unauthorized('Jeton içeriği okunamadı');
    }
    if (!payload.sub || typeof payload.exp !== 'number') {
        throw errors_1.HttpError.unauthorized('Jeton eksik alan içeriyor');
    }
    if (payload.exp * 1000 < Date.now()) {
        throw errors_1.HttpError.unauthorized('Jetonun süresi doldu');
    }
    return payload.sub;
};
exports.verifyToken = verifyToken;
//# sourceMappingURL=tokens.js.map