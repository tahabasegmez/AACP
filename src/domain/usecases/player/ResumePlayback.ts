import { Result } from '@core/error';
import { AudioPlayerService } from '../../services';
import { NoParamUseCase } from '../UseCase';
import { runPlayback } from './playbackResult';

/** ResumePlayback — duraklatılmış oynatmayı kaldığı yerden sürdürür. */
export class ResumePlayback implements NoParamUseCase<void> {
  constructor(private readonly player: AudioPlayerService) {}

  execute(): Promise<Result<void>> {
    return runPlayback(() => this.player.resume());
  }
}
