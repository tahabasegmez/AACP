import { Result } from '@core/error';
import { Preferences } from '../../entities';
import { PreferencesRepository } from '../../repositories';
import { NoParamUseCase } from '../UseCase';

/** GetPreferences — kayıtlı tercihleri getirir (yoksa varsayılanlar). */
export class GetPreferences implements NoParamUseCase<Preferences> {
  constructor(private readonly repo: PreferencesRepository) {}

  execute(): Promise<Result<Preferences>> {
    return this.repo.get();
  }
}
