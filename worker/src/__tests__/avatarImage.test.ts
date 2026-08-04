import { describe, expect, it } from 'vitest';
import { avatarPath, decodeAvatar } from '../avatarImage';

/** Bayt dizisini base64'e çevirir (test girdisi kurmak için). */
const base64 = (bytes: number[]): string =>
  btoa(String.fromCharCode(...bytes));

/** Geçerli bir görselin ilk baytları + biraz dolgu. */
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe('decodeAvatar', () => {
  it('JPEG imzasını tanır', () => {
    const result = decodeAvatar({ base64: base64(JPEG) });

    expect(result.contentType).toBe('image/jpeg');
    expect(result.extension).toBe('jpg');
    expect(new Uint8Array(result.bytes)[0]).toBe(0xff);
  });

  it('PNG imzasını tanır', () => {
    expect(decodeAvatar({ base64: base64(PNG) }).contentType).toBe('image/png');
  });

  it('WebP imzasını tanır', () => {
    expect(decodeAvatar({ base64: base64(WEBP) }).contentType).toBe('image/webp');
  });

  it('türü İSTEMCİNİN BEYANINDAN değil içerikten okur', () => {
    // Seçici iOS'ta özgün fotoğrafın türünü (image/heic) bildirip gövdeyi
    // JPEG'e çevirebiliyor; beyana güvenmek geçerli bir görseli reddederdi.
    const result = decodeAvatar({ base64: base64(JPEG), contentType: 'image/heic' });

    expect(result.contentType).toBe('image/jpeg');
  });

  it('beyan doğru olsa bile içerik tanınmıyorsa reddeder', () => {
    // Kova genel okumaya açık; "bu bir JPEG" demesiyle yetinmek, oraya başka
    // bir dosya koyabilmesi demekti.
    expect(() =>
      decodeAvatar({ base64: base64([0x00, 0x01, 0x02, 0x03]), contentType: 'image/jpeg' }),
    ).toThrow(/Desteklenmeyen görsel biçimi/);
  });

  it('veri önekini ayıklar', () => {
    // Bazı istemciler `data:image/png;base64,` önekiyle gönderir.
    const result = decodeAvatar({ base64: `data:image/png;base64,${base64(PNG)}` });

    expect(result.contentType).toBe('image/png');
  });

  it('boş gövdeyi reddeder', () => {
    expect(() => decodeAvatar({})).toThrow(/base64 gerekli/);
  });

  it('bozuk base64 reddedilir', () => {
    expect(() => decodeAvatar({ base64: '!!!' })).toThrow(/çözülemedi/);
  });

  it('boyut sınırını aşan görseli reddeder', () => {
    const big = btoa(String.fromCharCode(...JPEG) + 'a'.repeat(700 * 1024));
    expect(() => decodeAvatar({ base64: big })).toThrow(/çok büyük/);
  });
});

describe('avatarPath', () => {
  it('kullanıcı kimliğiyle gruplar ve zaman damgası taşır', () => {
    // Zaman damgası olmasaydı yeni fotoğraf önbellekte takılı kalırdı.
    expect(avatarPath('user-1', 'jpg', 1754200000000)).toBe('user-1/1754200000000.jpg');
  });
});
