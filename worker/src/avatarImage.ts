import { HttpError } from './errors';

/**
 * Profil fotoğrafı gövdesinin çözümlenmesi — saf, ayrı test edilir.
 *
 * Görsel base64 olarak gelir. Ham ikili gövde daha ekonomik olurdu ama router
 * tek tip JSON okur; base64'ün ~%33 şişmesi, küçültülmüş bir avatar için
 * (istemci 512 px'e indirir) önemsizdir ve tüm uçlar aynı gövde sözleşmesini
 * paylaşmaya devam eder.
 */

/**
 * Tanınan biçimler ve imzaları (magic bytes).
 *
 * Tür, istemcinin BEYANINDAN değil dosyanın kendisinden okunur. İki sebeple:
 *
 *  - **Doğruluk:** görsel seçici bazen özgün fotoğrafın türünü bildirir
 *    (ör. iOS'ta `image/heic`) ama küçültme sırasında gövdeyi JPEG'e çevirir.
 *    Beyana güvenmek, geçerli bir JPEG'i reddetmek olurdu.
 *  - **Güvenlik:** kova genel okumaya açık. İstemcinin "bu bir JPEG" demesiyle
 *    yetinmek, oraya başka bir dosya koyabilmesi demekti.
 */
const SIGNATURES: readonly {
  readonly contentType: string;
  readonly extension: string;
  readonly matches: (bytes: Uint8Array) => boolean;
}[] = [
  {
    contentType: 'image/jpeg',
    extension: 'jpg',
    matches: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    contentType: 'image/png',
    extension: 'png',
    matches: b =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    contentType: 'image/webp',
    extension: 'webp',
    // "RIFF" + 4 bayt uzunluk + "WEBP"
    matches: b =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

/**
 * Çözülmüş görselin en fazla boyutu.
 *
 * İstemci fotoğrafı zaten küçültür; bu sınır kötüye kullanıma karşıdır.
 * Router'ın 1 MB'lık gövde sınırının ALTINDA tutulur ki hata mesajı
 * "gövde çok büyük" yerine anlaşılır olsun.
 */
const MAX_BYTES = 600 * 1024;

export interface DecodedAvatar {
  readonly bytes: ArrayBuffer;
  readonly contentType: string;
  readonly extension: string;
}

/** İstek gövdesini doğrular ve ikili veriye çevirir. */
export const decodeAvatar = (body: unknown): DecodedAvatar => {
  const input = (body ?? {}) as { base64?: unknown };

  if (typeof input.base64 !== 'string' || input.base64.length === 0) {
    throw HttpError.badRequest('base64 gerekli');
  }
  // Bazı istemciler veri önekiyle gönderir; kabul edip ayıklamak, çağıranı
  // biçim ayrıntısıyla uğraştırmaktan iyidir.
  const payload = input.base64.replace(/^data:[^;]+;base64,/, '');

  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw HttpError.badRequest('base64 çözülemedi');
  }

  if (binary.length > MAX_BYTES) {
    throw HttpError.badRequest(`Görsel çok büyük (en fazla ${MAX_BYTES / 1024} KB)`);
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const format = SIGNATURES.find(signature => signature.matches(bytes));
  if (!format) {
    throw HttpError.badRequest(
      'Desteklenmeyen görsel biçimi. JPEG, PNG ya da WebP kullanın.',
    );
  }

  return {
    bytes: bytes.buffer,
    contentType: format.contentType,
    extension: format.extension,
  };
};

/**
 * Depodaki dosya yolu.
 *
 * Kullanıcı kimliği yolun BAŞINDA durur: dosyalar kullanıcıya göre gruplanır
 * ve hesap silindiğinde tek önekle temizlenir. Zaman damgası, önbelleklerin
 * (CDN, `FastImage`) eski fotoğrafı göstermesini engeller — sabit bir ad
 * kullansaydık yeni fotoğraf günlerce görünmeyebilirdi.
 */
export const avatarPath = (userId: string, extension: string, nowMs: number): string =>
  `${userId}/${nowMs}.${extension}`;
