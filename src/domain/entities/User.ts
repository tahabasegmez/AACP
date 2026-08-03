/**
 * User — uygulamayı kullanan kişi.
 *
 * TEK kullanıcı kavramı vardır; "anonim" ve "hesaplı" ayrı entity'ler DEĞİLDİR.
 * Uygulama ilk açılışta cihaza bağlı anonim bir kullanıcı edinir; kişi daha
 * sonra e-posta ile hesap oluşturursa AYNI kullanıcı kaydı yükseltilir
 * (`email` dolar). Böylece anonimken biriken veri (kaldığın yer, takipler,
 * listeler) hesaba geçerken kaybolmaz ve veri modeli çatallanmaz.
 */
export interface User {
  readonly id: string;
  /** Hesap bağlandıysa e-posta; anonim kullanıcıda boştur. */
  readonly email?: string;
  /** Görünen ad (profil). */
  readonly displayName?: string;
  /** Profil fotoğrafının genel adresi; yoksa baş harf rozeti gösterilir. */
  readonly avatarUrl?: string;
  readonly createdAt: number;
}

/** Kullanıcı henüz bir hesaba bağlanmamış mı? */
export const isAnonymous = (user: User | null | undefined): boolean =>
  !!user && !user.email;

/** Listelerde/profilde gösterilecek ad. */
export const userDisplayName = (user: User | null | undefined): string => {
  if (!user) {
    return 'Misafir';
  }
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }
  // E-postanın yerel kısmı makul bir varsayılan addır.
  return user.email?.split('@')[0] ?? 'Misafir';
};

/**
 * Avatar rozetinde gösterilecek TEK harf.
 *
 * Görünen addan türer, böylece kullanıcı adını değiştirdiğinde rozet de
 * değişir. Türkçe'ye duyarlı büyütme kullanılır: `i` harfi `I` değil `İ`
 * olmalıdır. Harf bulunamazsa (ör. ad yalnızca emoji) boş döner ve çağıran
 * taraf kişi simgesine düşer.
 */
export const userInitial = (user: User | null | undefined): string => {
  const letter = [...userDisplayName(user)].find(char => /\p{L}|\p{N}/u.test(char));
  return letter ? letter.toLocaleUpperCase('tr-TR') : '';
};

/**
 * AuthSession — sunucu oturumu.
 *
 * Jeton ve süresi; istemci bunu saklar ve isteklere ekler. Süre dolduğunda
 * yenileme `ApiClient` tarafından şeffaf biçimde yapılır.
 */
export interface AuthSession {
  readonly token: string;
  readonly userId: string;
  /** Jetonun geçerlilik sonu (epoch ms). */
  readonly expiresAt: number;
}

/** Basit e-posta doğrulaması (sunucu ayrıca doğrular). */
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Şifre için asgari kural — sunucudaki kuralla aynı tutulmalıdır. */
export const MIN_PASSWORD_LENGTH = 8;

export const isValidPassword = (password: string): boolean =>
  password.length >= MIN_PASSWORD_LENGTH;
