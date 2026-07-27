import { Result } from '@core/error';
import { User } from '../entities';

export interface CredentialsInput {
  readonly email: string;
  readonly password: string;
}

/**
 * UserRepository — kullanıcı kimliği ve profilinin PORTU.
 *
 * Sunucu yapılandırılmamışsa uygulama yine çalışır: bu durumda yalnızca yerel
 * (anonim) bir kullanıcı vardır ve hesap işlemleri "kullanılamıyor" hatası
 * döner. Böylece sunucusuz kurulum bozulmaz.
 *
 * Anonimden hesaba geçiş `register`/`signIn` ile yapılır ve MEVCUT kullanıcı
 * kaydını yükseltir — veri taşınması sunucu tarafında hallolur.
 */
export interface UserRepository {
  /** Sunucu destekli hesap işlemleri kullanılabilir mi. */
  readonly accountsAvailable: boolean;

  /** O anki kullanıcı (anonim olabilir); hiç oturum yoksa null. */
  current(): Promise<Result<User | null>>;

  /** Anonim oturum açar/yeniler (cihaz kimliğiyle). */
  signInAnonymously(): Promise<Result<User>>;

  /** Yeni hesap oluşturur ve mevcut anonim veriyi bu hesaba bağlar. */
  register(input: CredentialsInput): Promise<Result<User>>;

  /** Var olan hesaba giriş yapar. */
  signIn(input: CredentialsInput): Promise<Result<User>>;

  /** Oturumu kapatır; cihazda anonim kullanıma geri dönülür. */
  signOut(): Promise<Result<void>>;

  /** Profil bilgisini günceller. */
  updateProfile(input: { displayName?: string }): Promise<Result<User>>;
}
