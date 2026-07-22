import { Result } from '@core/error';

/**
 * UseCase — tek bir iş akışını temsil eden sözleşme.
 *
 * Girdi `Params`, çıktı `Result<T>`. Parametresiz use case'ler için `void`.
 * Bu ortak imza, use case'leri UI/CarPlay'de tutarlı çağırmamızı sağlar.
 */
export interface UseCase<Params, T> {
  execute(params: Params): Promise<Result<T>>;
}

/** Parametre almayan use case'ler için kısayol. */
export interface NoParamUseCase<T> {
  execute(): Promise<Result<T>>;
}
