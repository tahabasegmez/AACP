/**
 * Result<T> — hata fırlatmak yerine başarı/başarısızlığı değer olarak taşır.
 *
 * Neden? İş mantığında (domain/data) `throw` yerine açık bir sonuç döndürmek,
 * hangi hataların olabileceğini tipten görmemizi ve UI'da tutarlı ele almamızı
 * sağlar. UI/query katmanında istenirse `unwrap` ile throw'a çevrilebilir.
 */
import { AppError } from './AppError';

export type Result<T> = Success<T> | Failure;

export interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Failure {
  readonly ok: false;
  readonly error: AppError;
}

export const ok = <T>(value: T): Success<T> => ({ ok: true, value });

export const fail = (error: AppError): Failure => ({ ok: false, error });

export const isOk = <T>(result: Result<T>): result is Success<T> => result.ok;

export const isFail = <T>(result: Result<T>): result is Failure => !result.ok;

/** Başarılıysa değeri döner, değilse hatayı fırlatır (query katmanı için pratik). */
export const unwrap = <T>(result: Result<T>): T => {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
};
