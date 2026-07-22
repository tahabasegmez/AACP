import { AppError, Result, fail, ok } from '@core/error';

/**
 * Oynatıcı işlemlerini Result'a saran ortak yardımcı.
 * Her transport use case'i (pause/resume/seek ...) aynı hata yönetimini paylaşsın.
 */
export const runPlayback = async (
  fn: () => Promise<void>,
): Promise<Result<void>> => {
  try {
    await fn();
    return ok(undefined);
  } catch (error) {
    return fail(AppError.from(error, 'PLAYBACK'));
  }
};
