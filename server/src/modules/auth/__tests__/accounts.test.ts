import { MemoryStore } from '../../../storage/MemoryStore';
import { AuthService } from '../AuthService';
import { hashPassword, verifyPassword } from '../password';

const makeSut = () => {
  const store = new MemoryStore();
  return { store, auth: new AuthService(store, 'test-secret-key', 3600) };
};

describe('password', () => {
  it('doğru şifreyi doğrular', async () => {
    const hash = await hashPassword('sifre12345');
    expect(await verifyPassword('sifre12345', hash)).toBe(true);
  });

  it('yanlış şifreyi reddeder', async () => {
    const hash = await hashPassword('sifre12345');
    expect(await verifyPassword('baskasifre', hash)).toBe(false);
  });

  it('bozuk özet biçiminde false döner', async () => {
    expect(await verifyPassword('sifre12345', 'bozuk')).toBe(false);
  });

  it('aynı şifre farklı özet üretir (salt)', async () => {
    const a = await hashPassword('sifre12345');
    const b = await hashPassword('sifre12345');
    expect(a).not.toBe(b);
  });
});

describe('AuthService — hesaplar', () => {
  it('hesap oluşturur ve oturum döner', async () => {
    const { auth } = makeSut();
    const session = await auth.register('Test@Ornek.com', 'sifre12345');

    expect(session.token).toBeTruthy();
    // E-posta normalize edilir (küçük harf).
    expect(session.user.email).toBe('test@ornek.com');
  });

  it('aynı e-posta ikinci kez kaydedilemez', async () => {
    const { auth } = makeSut();
    await auth.register('a@b.com', 'sifre12345');
    await expect(auth.register('a@b.com', 'baskasifre1')).rejects.toThrow();
  });

  it('geçersiz e-posta ve kısa şifre reddedilir', async () => {
    const { auth } = makeSut();
    await expect(auth.register('gecersiz', 'sifre12345')).rejects.toThrow();
    await expect(auth.register('a@b.com', 'kisa')).rejects.toThrow();
  });

  it('doğru bilgilerle giriş yapılır', async () => {
    const { auth } = makeSut();
    await auth.register('a@b.com', 'sifre12345');

    const session = await auth.signIn('a@b.com', 'sifre12345');
    expect(session.user.email).toBe('a@b.com');
  });

  it('yanlış şifreyle giriş reddedilir', async () => {
    const { auth } = makeSut();
    await auth.register('a@b.com', 'sifre12345');
    await expect(auth.signIn('a@b.com', 'yanlissifre')).rejects.toThrow();
  });

  it('olmayan kullanıcı ve yanlış şifre AYNI hatayı verir (bilgi sızmasın)', async () => {
    const { auth } = makeSut();
    await auth.register('a@b.com', 'sifre12345');

    const wrongPassword = await auth.signIn('a@b.com', 'yanlissifre').catch(e => e.message);
    const noUser = await auth.signIn('yok@b.com', 'sifre12345').catch(e => e.message);
    expect(wrongPassword).toBe(noUser);
  });

  it('ANONİM kullanıcıyı yükseltir — aynı kimlik korunur (veri taşınır)', async () => {
    const { auth } = makeSut();
    const anon = await auth.authenticateDevice('cihaz-12345678');

    const upgraded = await auth.register('a@b.com', 'sifre12345', anon.userId);

    // Aynı kullanıcı kaydı: anonimken biriken veri hesaba doğal olarak geçer.
    expect(upgraded.userId).toBe(anon.userId);
    expect(upgraded.user.email).toBe('a@b.com');
  });

  it('zaten hesaplı kullanıcı yükseltilmez, yeni hesap açılır', async () => {
    const { auth } = makeSut();
    const first = await auth.register('a@b.com', 'sifre12345');
    const second = await auth.register('c@d.com', 'sifre12345', first.userId);

    expect(second.userId).not.toBe(first.userId);
  });

  it('cihaz oturumu tekrar açılınca aynı kullanıcıya bağlanır', async () => {
    const { auth } = makeSut();
    const first = await auth.authenticateDevice('cihaz-12345678');
    const second = await auth.authenticateDevice('cihaz-12345678');
    expect(second.userId).toBe(first.userId);
  });

  it('profil güncellenir', async () => {
    const { auth } = makeSut();
    const session = await auth.register('a@b.com', 'sifre12345');

    const profile = await auth.updateProfile(session.userId, '  Taha  ');
    expect(profile.displayName).toBe('Taha');
  });
});
