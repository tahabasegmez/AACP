import { AppError } from '@core/error';
import { HttpClient, HttpRequestOptions, KeyValueStorage } from '@core/ports';
import { ApiClient } from '../ApiClient';

const BASE = 'https://api.test';

/** Bellek içi depo — MMKV'nin kullandığımız yüzeyini taklit eder. */
class FakeStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  getString(key: string) {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string) {
    this.map.set(key, value);
  }
  delete(key: string) {
    this.map.delete(key);
  }
  getAllKeys() {
    return [...this.map.keys()];
  }
  clearAll() {
    this.map.clear();
  }
}

interface Call {
  readonly url: string;
  readonly body: unknown;
  readonly headers?: Record<string, string>;
}

/**
 * Yolun sonuna göre cevap veren sahte HTTP istemcisi.
 *
 * `handlers` her yol için bir fonksiyon alır; fırlatırsa istek başarısız olur.
 */
class FakeHttp implements HttpClient {
  readonly calls: Call[] = [];

  constructor(private readonly handlers: Record<string, (call: Call) => unknown>) {}

  async getText(): Promise<string> {
    throw new Error('kullanılmıyor');
  }

  async postJson<T>(
    url: string,
    body: unknown,
    options?: HttpRequestOptions,
  ): Promise<T | undefined> {
    const call: Call = { url, body, headers: options?.headers as Record<string, string> };
    this.calls.push(call);

    const path = url.replace(BASE, '');
    const handler = this.handlers[path];
    if (!handler) {
      throw new Error(`beklenmeyen yol: ${path}`);
    }
    return handler(call) as T;
  }
}

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

const unauthorized = (): never => {
  throw new AppError('UNAUTHORIZED', 'süresi doldu');
};

describe('ApiClient — 401 sonrası oturum kurtarma', () => {
  it('süresi dolan jetonu YENİLEME jetonuyla tazeler, misafire DÜŞMEZ', () => {
    // Bu davranışın kaybı, kullanıcının jetonu her eskidiğinde sessizce
    // misafire dönmesi demekti (görünen ad "Misafir"e düşüyordu).
    const storage = new FakeStorage();
    storage.set('aacp.auth.token', 'eski-jeton');
    storage.set('aacp.auth.refresh', 'yenileme-jetonu');

    let firstAttempt = true;
    const http = new FakeHttp({
      '/v1/auth/profile': () => {
        if (firstAttempt) {
          firstAttempt = false;
          unauthorized();
        }
        return { id: 'u1' };
      },
      '/v1/auth/refresh': () => ({ token: 'yeni-jeton', refreshToken: 'yenileme-jetonu' }),
    });

    const client = new ApiClient(http, storage, logger, BASE);

    return client.post('/v1/auth/profile', { displayName: 'Taha' }).then(result => {
      expect(result).toEqual({ id: 'u1' });

      const paths = http.calls.map(c => c.url.replace(BASE, ''));
      expect(paths).toEqual(['/v1/auth/profile', '/v1/auth/refresh', '/v1/auth/profile']);

      // Anonim oturum AÇILMAMALI — kimlik korunmalı.
      expect(paths).not.toContain('/v1/auth/device');
      // Tekrar denenen istek yeni jetonu taşımalı.
      expect(http.calls[2].headers?.Authorization).toBe('Bearer yeni-jeton');
    });
  });

  it('yenileme jetonu da geçersizse anonim oturuma düşer', async () => {
    const storage = new FakeStorage();
    storage.set('aacp.auth.token', 'eski-jeton');
    storage.set('aacp.auth.refresh', 'bozuk');

    let firstAttempt = true;
    const http = new FakeHttp({
      '/v1/sync/progress': () => {
        if (firstAttempt) {
          firstAttempt = false;
          unauthorized();
        }
        return { accepted: 1 };
      },
      '/v1/auth/refresh': () => {
        throw new AppError('UNAUTHORIZED', 'yenileme reddedildi');
      },
      '/v1/auth/device': () => ({ token: 'anonim-jeton' }),
    });

    const client = new ApiClient(http, storage, logger, BASE);
    await client.post('/v1/sync/progress', { records: [] });

    const paths = http.calls.map(c => c.url.replace(BASE, ''));
    expect(paths).toContain('/v1/auth/device');
    // Geçersiz yenileme jetonu saklanmaya devam etmemeli.
    expect(storage.getString('aacp.auth.refresh')).toBeNull();
  });

  it('yenileme başarısızsa erişim jetonu da temizlenmiş olur', async () => {
    const storage = new FakeStorage();
    storage.set('aacp.auth.token', 'eski-jeton');

    const http = new FakeHttp({
      '/v1/sync/progress': unauthorized,
      '/v1/auth/device': () => ({}),
    });

    const client = new ApiClient(http, storage, logger, BASE);
    await expect(client.post('/v1/sync/progress', {})).rejects.toBeTruthy();

    expect(storage.getString('aacp.auth.token')).toBeNull();
  });
});
