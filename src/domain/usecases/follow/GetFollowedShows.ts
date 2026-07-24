import { Result, ok } from '@core/error';
import { Show } from '../../entities';
import { FollowRepository, ShowCatalogRepository } from '../../repositories';
import { NoParamUseCase } from '../UseCase';

/**
 * GetFollowedShows — takip edilen şovları tam Show nesneleri olarak döner.
 * Kütüphane ekranı ve "yeni bölümler" satırı için kullanılır.
 */
export class GetFollowedShows implements NoParamUseCase<readonly Show[]> {
  constructor(
    private readonly follow: FollowRepository,
    private readonly catalog: ShowCatalogRepository,
  ) {}

  async execute(): Promise<Result<readonly Show[]>> {
    const idsResult = await this.follow.getFollowedIds();
    if (!idsResult.ok) {
      return idsResult;
    }
    const ids = new Set(idsResult.value);
    if (ids.size === 0) {
      return ok([]);
    }
    const showsResult = await this.catalog.getShows();
    if (!showsResult.ok) {
      return showsResult;
    }
    return ok(showsResult.value.filter(show => ids.has(show.id)));
  }
}
