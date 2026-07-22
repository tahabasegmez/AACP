import { Result } from '@core/error';
import { AudioPlayerService } from '../../services';
import { NoParamUseCase } from '../UseCase';
import { runPlayback } from './playbackResult';

/** PausePlayback — çalmakta olan bölümü duraklatır. */
export class PausePlayback implements NoParamUseCase<void> {
  constructor(private readonly player: AudioPlayerService) {}

  execute(): Promise<Result<void>> {
    return runPlayback(() => this.player.pause());
  }
}
