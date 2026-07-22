import { Result } from '@core/error';
import { AudioPlayerService } from '../../services';
import { NoParamUseCase } from '../UseCase';
import { runPlayback } from './playbackResult';

/** StopPlayback — oynatmayı tamamen durdurur (kuyruğu boşaltır). */
export class StopPlayback implements NoParamUseCase<void> {
  constructor(private readonly player: AudioPlayerService) {}

  execute(): Promise<Result<void>> {
    return runPlayback(() => this.player.stop());
  }
}
