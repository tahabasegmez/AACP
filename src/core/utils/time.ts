/**
 * Zaman/süre yardımcıları. Saf fonksiyonlar — platform bağımsız, test edilebilir.
 */

/** Saniyeyi "1:02:03" / "5:09" biçimine çevirir. */
export const formatDuration = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

/**
 * iTunes `duration` alanını saniyeye çevirir.
 * Girdi "HH:MM:SS", "MM:SS" veya doğrudan saniye ("3600") olabilir.
 */
export const parseItunesDuration = (raw?: string | number): number => {
  if (raw == null) {
    return 0;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const trimmed = raw.trim();
  if (!trimmed.includes(':')) {
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }
  const parts = trimmed.split(':').map(Number);
  if (parts.some(isNaN)) {
    return 0;
  }
  return parts.reduce((acc, part) => acc * 60 + part, 0);
};
