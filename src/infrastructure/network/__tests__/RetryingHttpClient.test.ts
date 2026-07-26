import { AppError } from '@core/error';
import { HttpClient } from '@core/ports';
import { RetryingHttpClient } from '../RetryingHttpClient';

/** Belirli sayıda hata fırlatıp sonra başarılı olan sahte istemci. */
class FlakyHttp implements HttpClient {
  public calls = 0;
  constructor(
    private readonly failTimes: number,
    private readonly error: AppError,
    private readonly success = 'OK',
  ) {}
  async getText(): Promise<string> {
    this.calls++;
    if (this.calls <= this.failTimes) {
      throw this.error;
    }
    return this.success;
  }
  async postJson<T>(): Promise<T | undefined> {
    this.calls++;
    if (this.calls <= this.failTimes) {
      throw this.error;
    }
    return undefined;
  }
}

// baseDelayMs=0 → testler beklemesin.
const retrying = (inner: HttpClient, max: number) =>
  new RetryingHttpClient(inner, max, 0);

describe('RetryingHttpClient', () => {
  it('geçici NETWORK hatasından sonra başarır', async () => {
    const inner = new FlakyHttp(2, AppError.network('geçici'));
    const result = await retrying(inner, 3).getText('u');
    expect(result).toBe('OK');
    expect(inner.calls).toBe(3); // 2 hata + 1 başarı
  });

  it('retry hakkı bitince hata fırlatır', async () => {
    const inner = new FlakyHttp(10, AppError.network('sürekli'));
    await expect(retrying(inner, 2).getText('u')).rejects.toBeInstanceOf(AppError);
    expect(inner.calls).toBe(3); // ilk + 2 retry
  });

  it('kalıcı hatayı (PARSE) yeniden DENEMEZ', async () => {
    const inner = new FlakyHttp(10, AppError.parse('bozuk'));
    await expect(retrying(inner, 3).getText('u')).rejects.toMatchObject({ code: 'PARSE' });
    expect(inner.calls).toBe(1); // retry yok
  });

  it('ilk denemede başarırsa tek çağrı', async () => {
    const inner = new FlakyHttp(0, AppError.network('x'));
    await retrying(inner, 3).getText('u');
    expect(inner.calls).toBe(1);
  });
});
