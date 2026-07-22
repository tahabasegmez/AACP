import { Result } from '@core/error';
import { Show } from '../entities';
import { ShowCatalogRepository } from '../repositories';
import { NoParamUseCase } from './UseCase';

/**
 * GetShowCatalog — tüm AA şovlarının listesini getirir.
 * Ana ekranda şov listesini beslemek için kullanılır.
 */
export class GetShowCatalog implements NoParamUseCase<readonly Show[]> {
  constructor(private readonly catalog: ShowCatalogRepository) {}

  execute(): Promise<Result<readonly Show[]>> {
    return this.catalog.getShows();
  }
}
