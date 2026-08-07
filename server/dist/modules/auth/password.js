"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = exports.hashPassword = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
/** scrypt maliyet parametreleri — mobil istemci için makul, sunucuya yük bindirmez. */
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
/**
 * Şifre özetleme — Node'un yerleşik `scrypt`i ile.
 *
 * Harici bir bağımlılık (bcrypt/argon2) EKLENMEZ: ikisi de native derleme
 * gerektirir ve ARM (Raspberry Pi) kurulumunu zorlaştırır. scrypt, Node
 * çekirdeğinde bulunur ve şifre özetleme için tasarlanmıştır.
 *
 * Biçim: `salt:hash` (ikisi de hex).
 */
const hashPassword = async (password) => {
    const salt = node_crypto_1.default.randomBytes(SALT_BYTES).toString('hex');
    const derived = await scrypt(password, salt);
    return `${salt}:${derived}`;
};
exports.hashPassword = hashPassword;
/**
 * Şifreyi saklanan özete karşı doğrular.
 * Karşılaştırma sabit zamanlıdır (zamanlama saldırısına karşı).
 */
const verifyPassword = async (password, stored) => {
    const [salt, expected] = stored.split(':');
    if (!salt || !expected) {
        return false;
    }
    const derived = await scrypt(password, salt);
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && node_crypto_1.default.timingSafeEqual(a, b);
};
exports.verifyPassword = verifyPassword;
const scrypt = (password, salt) => new Promise((resolve, reject) => {
    node_crypto_1.default.scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
        if (error) {
            reject(error);
        }
        else {
            resolve(derivedKey.toString('hex'));
        }
    });
});
//# sourceMappingURL=password.js.map