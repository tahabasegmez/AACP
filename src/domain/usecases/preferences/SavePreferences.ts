import { Result } from '@core/error';
import { Preferences } from '../../entities';
import { PreferencesRepository } from '../../repositories';
import { UseCase } from '../UseCase';

/** SavePreferences — tercihleri kalıcı olarak kaydeder. */
export class SavePreferences implements UseCase<Preferences, void> {
  constructor(private readonly repo: PreferencesRepository) {}

  execute(prefs: Preferences): Promise<Result<void>> {
    return this.repo.save(prefs);
  }
}
