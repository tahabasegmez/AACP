import { HttpError } from './errors';

/**
 * Profil fotoğrafı gövdesinin çözümlenmesi — saf, ayrı test edilir.
 *
 * Görsel base64 olarak gelir. Ham ikili gövde daha ekonomik olurdu ama router
 * tek tip JSON okur; base64'ün ~%33 şişmesi, küçültülmüş bir avatar için
 * (istemci 512 px'e indirir) önemsizdir ve tüm uçlar aynı gövde sözleşmesini
 * paylaşmaya devam eder.
 */

/** Kabul edilen türler — tarayıcı/iOS'un çözebildiği yaygın biçimler. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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
  const input = (body ?? {}) as { base64?: unknown; contentType?: unknown };

  const contentType = typeof input.contentType === 'string' ? input.contentType : '';
  const extension = EXTENSIONS[contentType];
  if (!extension) {
    throw HttpError.badRequest(
      `Desteklenmeyen görsel türü: ${contentType || 'belirtilmedi'}`,
    );
  }

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
  return { bytes: bytes.buffer, contentType, extension };
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
