"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MemoryStore_1 = require("../../../storage/MemoryStore");
const AuthService_1 = require("../AuthService");
const tokens_1 = require("../tokens");
const SECRET = 'test-secret';
describe('tokens', () => {
    it('üretilen jetonu doğrular', () => {
        const token = (0, tokens_1.createToken)('user-1', SECRET, 60);
        expect((0, tokens_1.verifyToken)(token, SECRET)).toBe('user-1');
    });
    it('yanlış anahtarla imzalanmış jetonu reddeder', () => {
        const token = (0, tokens_1.createToken)('user-1', SECRET, 60);
        expect(() => (0, tokens_1.verifyToken)(token, 'baska-anahtar')).toThrow(/imza/i);
    });
    it('süresi dolmuş jetonu reddeder', () => {
        const token = (0, tokens_1.createToken)('user-1', SECRET, -1);
        expect(() => (0, tokens_1.verifyToken)(token, SECRET)).toThrow(/süresi/i);
    });
    it('bozuk biçimi reddeder', () => {
        expect(() => (0, tokens_1.verifyToken)('bozuk', SECRET)).toThrow(/biçim/i);
    });
});
describe('AuthService', () => {
    const makeSut = () => new AuthService_1.AuthService(new MemoryStore_1.MemoryStore(), SECRET, 3600);
    it('aynı cihaz için aynı kullanıcıyı döner', async () => {
        const auth = makeSut();
        const first = await auth.authenticateDevice('device-abc-123');
        const second = await auth.authenticateDevice('device-abc-123');
        expect(second.userId).toBe(first.userId);
    });
    it('farklı cihazlar farklı kullanıcı alır', async () => {
        const auth = makeSut();
        const a = await auth.authenticateDevice('device-aaa-111');
        const b = await auth.authenticateDevice('device-bbb-222');
        expect(a.userId).not.toBe(b.userId);
    });
    it('çok kısa deviceId reddedilir', async () => {
        const auth = makeSut();
        await expect(auth.authenticateDevice('kisa')).rejects.toThrow(/deviceId/);
    });
    it('Bearer başlığından kullanıcıyı çözer', async () => {
        const auth = makeSut();
        const session = await auth.authenticateDevice('device-abc-123');
        expect(auth.requireUserId(`Bearer ${session.token}`)).toBe(session.userId);
    });
    it('başlık yoksa 401', () => {
        const auth = makeSut();
        expect(() => auth.requireUserId(undefined)).toThrow(/oturum/i);
    });
});
//# sourceMappingURL=auth.test.js.map