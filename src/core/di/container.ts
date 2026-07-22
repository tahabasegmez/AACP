/**
 * Çok hafif bir Dependency Injection container'ı.
 *
 * Ağır bir DI kütüphanesi (inversify vb.) yerine, anlaşılması kolay ve
 * tip güvenli küçük bir "service locator" kullanıyoruz. Bağımlılıklar `app/di`
 * içinde bir kez kaydedilir (register), her yerden `resolve` ile alınır.
 *
 * `Token<T>` sayesinde resolve çıktısı doğru tipte gelir — string anahtar yok.
 */
export interface Token<T> {
  readonly key: symbol;
  /** Yalnızca tip taşıması için; çalışma zamanında kullanılmaz. */
  readonly _type?: T;
}

export const createToken = <T>(description: string): Token<T> => ({
  key: Symbol(description),
});

export class Container {
  private readonly factories = new Map<symbol, () => unknown>();
  private readonly instances = new Map<symbol, unknown>();

  /** Singleton kayıt: factory ilk resolve'da bir kez çalışır, sonuç cache'lenir. */
  register<T>(token: Token<T>, factory: () => T): void {
    this.factories.set(token.key, factory);
  }

  resolve<T>(token: Token<T>): T {
    if (this.instances.has(token.key)) {
      return this.instances.get(token.key) as T;
    }
    const factory = this.factories.get(token.key);
    if (!factory) {
      throw new Error(
        `DI: '${token.key.description}' için kayıt bulunamadı. app/di içinde register edildi mi?`,
      );
    }
    const instance = factory();
    this.instances.set(token.key, instance);
    return instance as T;
  }

  /** Testlerde container'ı sıfırlamak için. */
  reset(): void {
    this.factories.clear();
    this.instances.clear();
  }
}
