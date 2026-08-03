import { describe, expect, it } from 'vitest';
import { avatarPath, decodeAvatar } from '../avatarImage';

const base64 = (text: string): string => btoa(text);

describe('decodeAvatar', () => {
  it('geçerli görseli ikili veriye çevirir', () => {
    const result = decodeAvatar({ base64: base64('JPEG'), contentType: 'image/jpeg' });

    expect(result.extension).toBe('jpg');
    expect(result.contentType).toBe('image/jpeg');
    expect(new TextDecoder().decode(result.bytes)).toBe('JPEG');
  });

  it('veri önekini ayıklar', () => {
    // Bazı istemciler `data:image/png;base64,` önekiyle gönderir.
    const result = decodeAvatar({
      base64: `data:image/png;base64,${base64('PNG')}`,
      contentType: 'image/png',
    });

    expect(new TextDecoder().decode(result.bytes)).toBe('PNG');
  });

  it('desteklenmeyen türü reddeder', () => {
    // Çalıştırılabilir bir dosyanın genel kovaya girmesi kabul edilemez.
    expect(() => decodeAvatar({ base64: base64('x'), contentType: 'image/svg+xml' })).toThrow(
      /Desteklenmeyen/,
    );
  });

  it('tür verilmezse reddeder', () => {
    expect(() => decodeAvatar({ base64: base64('x') })).toThrow(/belirtilmedi/);
  });

  it('boş gövdeyi reddeder', () => {
    expect(() => decodeAvatar({ contentType: 'image/jpeg' })).toThrow(/base64 gerekli/);
  });

  it('bozuk base64 reddedilir', () => {
    expect(() => decodeAvatar({ base64: '!!!', contentType: 'image/jpeg' })).toThrow(
      /çözülemedi/,
    );
  });

  it('boyut sınırını aşan görseli reddeder', () => {
    const big = base64('a'.repeat(700 * 1024));
    expect(() => decodeAvatar({ base64: big, contentType: 'image/jpeg' })).toThrow(/çok büyük/);
  });
});

describe('avatarPath', () => {
  it('kullanıcı kimliğiyle gruplar ve zaman damgası taşır', () => {
    // Zaman damgası olmasaydı yeni fotoğraf önbellekte takılı kalırdı.
    expect(avatarPath('user-1', 'jpg', 1754200000000)).toBe('user-1/1754200000000.jpg');
  });
});
