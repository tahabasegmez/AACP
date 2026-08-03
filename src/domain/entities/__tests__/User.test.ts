import { User, isAnonymous, userDisplayName, userInitial } from '../User';

const user = (fields: Partial<User> = {}): User => ({
  id: 'u1',
  createdAt: 0,
  ...fields,
});

describe('isAnonymous', () => {
  it('e-postası olmayan kullanıcı misafirdir', () => {
    expect(isAnonymous(user())).toBe(true);
    expect(isAnonymous(user({ email: 'a@b.com' }))).toBe(false);
  });

  it('kullanıcı yoksa misafir SAYILMAZ (henüz oturum yok)', () => {
    expect(isAnonymous(null)).toBe(false);
  });
});

describe('userDisplayName', () => {
  it('görünen adı tercih eder', () => {
    expect(userDisplayName(user({ displayName: 'Taha', email: 'x@y.com' }))).toBe('Taha');
  });

  it('ad yoksa e-postanın yerel kısmına düşer', () => {
    expect(userDisplayName(user({ email: 'taha.b@ornek.com' }))).toBe('taha.b');
  });

  it('hiçbiri yoksa Misafir', () => {
    expect(userDisplayName(user())).toBe('Misafir');
    expect(userDisplayName(null)).toBe('Misafir');
  });

  it('yalnızca boşluktan oluşan adı yok sayar', () => {
    expect(userDisplayName(user({ displayName: '   ', email: 'a@b.com' }))).toBe('a');
  });
});

describe('userInitial', () => {
  it('görünen adın ilk harfini büyütür', () => {
    expect(userInitial(user({ displayName: 'Taha' }))).toBe('T');
  });

  it('Türkçe büyütme kuralını uygular', () => {
    // `i` harfi İngilizce kuralla `I` olurdu; Türkçe'de `İ` olmalıdır.
    expect(userInitial(user({ displayName: 'irem' }))).toBe('İ');
  });

  it('baştaki boşluk ve işaretleri atlar', () => {
    expect(userInitial(user({ displayName: '  @taha' }))).toBe('T');
  });

  it('harf bulunamazsa boş döner (çağıran kişi simgesine düşer)', () => {
    expect(userInitial(user({ displayName: '🎧' }))).toBe('');
  });

  it('misafirde M döner', () => {
    expect(userInitial(null)).toBe('M');
  });
});
