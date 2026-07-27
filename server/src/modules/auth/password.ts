import crypto from 'node:crypto';

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
export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derived = await scrypt(password, salt);
  return `${salt}:${derived}`;
};

/**
 * Şifreyi saklanan özete karşı doğrular.
 * Karşılaştırma sabit zamanlıdır (zamanlama saldırısına karşı).
 */
export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) {
    return false;
  }
  const derived = await scrypt(password, salt);
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const scrypt = (password: string, salt: string): Promise<string> =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey.toString('hex'));
      }
    });
  });
