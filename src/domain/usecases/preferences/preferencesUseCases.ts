import { Result } from '@core/error';
import { PreferenceKey, Preferences } from '../../entities';
import { PreferencesRepository } from '../../repositories';
import { NoParamUseCase, UseCase } from '../UseCase';

/**
 * Tercih use case'leri.
 *
 * İnce sarmalayıcılardır: kural (varsayılana düşme, alan bazında yazma) entity
 * ve repository'de yaşar. Yine de katman korunur — arayüz repository'yi
 * doğrudan tanımaz ve ileride kural eklemek (ör. "bu tercih yalnızca hesapla
 * senkronlanır") tek noktadan mümkün olur.
 */

export class GetPreferences implements NoParamUseCase<Preferences> {
  constructor(private readonly repo: PreferencesRepository) {}
  execute(): Promise<Result<Preferences>> {
    return this.repo.get();
  }
}

export interface SetPreferenceParams<K extends PreferenceKey = PreferenceKey> {
  readonly key: K;
  readonly value: Preferences[K];
}

export class SetPreference implements UseCase<SetPreferenceParams, void> {
  constructor(private readonly repo: PreferencesRepository) {}
  execute(params: SetPreferenceParams): Promise<Result<void>> {
    return this.repo.set(params.key, params.value);
  }
}
