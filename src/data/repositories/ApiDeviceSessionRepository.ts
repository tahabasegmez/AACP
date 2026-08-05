import { AppError, Result, fail, ok } from '@core/error';
import { PlaybackCommand, PlaybackDevice, parsePlaybackCommand } from '@domain/entities';
import {
  DeviceSessionClaim,
  DeviceSessionRepository,
  DeviceSessionTick,
} from '@domain/repositories';

/** Sunucudan dönen cihaz kaydı. */
interface DeviceDto {
  readonly id?: string;
  readonly name?: string;
  readonly platform?: string;
  readonly active?: boolean;
  readonly lastSeenAt?: string;
}

interface DevicesDto {
  readonly devices?: readonly DeviceDto[];
}

/** Bir turun yanıtı — liste + bu cihaza bırakılmış komut. */
interface TickDto extends DevicesDto {
  readonly command?: unknown;
  readonly nowPlaying?: unknown;
}

const EMPTY_CLAIM: DeviceSessionClaim = { devices: [], nowPlaying: null };
const EMPTY_TICK: DeviceSessionTick = { ...EMPTY_CLAIM, command: null };

/** Bu deponun ihtiyaç duyduğu API yüzeyi (bağımlılığı daraltır). */
export interface DeviceSessionApi {
  readonly enabled: boolean;
  get<T>(path: string): Promise<T | undefined>;
  post<T>(path: string, body: unknown): Promise<T | undefined>;
  getDeviceId(): string;
}

/**
 * ApiDeviceSessionRepository — oynatma oturumunu sunucuda tutar.
 *
 * Cihazın ADI burada üretilir: ayrı bir cihaz-bilgisi bağımlılığı eklemek
 * yerine platformdan türetilen okunabilir bir ad kullanılır. Kullanıcı için
 * anlamlı olan "hangi telefon" değil "hangi platform"dur; liste zaten kendi
 * cihazını "bu cihaz" olarak işaretler.
 */
export class ApiDeviceSessionRepository implements DeviceSessionRepository {
  constructor(
    private readonly api: DeviceSessionApi,
    private readonly platform: string,
  ) {}

  get available(): boolean {
    return this.api.enabled;
  }

  deviceId(): string {
    return this.api.getDeviceId();
  }

  async claim(): Promise<Result<DeviceSessionClaim>> {
    if (!this.api.enabled) {
      return ok(EMPTY_CLAIM);
    }
    try {
      const dto = await this.api.post<TickDto>('/v1/playback/claim', {
        deviceId: this.deviceId(),
        name: defaultName(this.platform),
        platform: this.platform,
      });
      return ok({
        devices: toDevices(dto),
        nowPlaying: parsePlaybackCommand(dto?.nowPlaying),
      });
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }

  async release(): Promise<Result<void>> {
    if (!this.api.enabled) {
      return ok(undefined);
    }
    try {
      await this.api.post('/v1/playback/release', { deviceId: this.deviceId() });
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }

  async poll(nowPlaying?: PlaybackCommand): Promise<Result<DeviceSessionTick>> {
    if (!this.api.enabled) {
      return ok(EMPTY_TICK);
    }
    try {
      const dto = await this.api.post<TickDto>('/v1/playback/poll', {
        deviceId: this.deviceId(),
        // Yalnızca çalan cihaz yayınlar; alan yoksa sunucu son yayını korur.
        nowPlaying: nowPlaying ?? null,
      });
      return ok({
        devices: toDevices(dto),
        command: parsePlaybackCommand(dto?.command),
        nowPlaying: parsePlaybackCommand(dto?.nowPlaying),
      });
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }

  async transfer(
    toDeviceId: string,
    command: PlaybackCommand,
  ): Promise<Result<readonly PlaybackDevice[]>> {
    if (!this.api.enabled) {
      return ok([]);
    }
    try {
      const dto = await this.api.post<DevicesDto>('/v1/playback/transfer', {
        toDeviceId,
        command,
      });
      return ok(toDevices(dto));
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }

  async list(): Promise<Result<readonly PlaybackDevice[]>> {
    if (!this.api.enabled) {
      return ok([]);
    }
    try {
      const dto = await this.api.get<DevicesDto>('/v1/playback/devices');
      return ok(toDevices(dto));
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }
}

/** Platformdan okunabilir bir cihaz adı. */
const defaultName = (platform: string): string =>
  platform === 'ios' ? 'iPhone' : platform === 'android' ? 'Android cihaz' : 'Cihaz';

/** Eksik alanlı kayıt atlanır — listede kimliksiz satır yer tutmamalı. */
const toDevices = (dto?: DevicesDto): PlaybackDevice[] =>
  (dto?.devices ?? [])
    .filter((device): device is DeviceDto & { id: string } => !!device.id)
    .map(device => ({
      id: device.id,
      name: device.name ?? 'Cihaz',
      platform: device.platform ?? 'unknown',
      active: device.active === true,
      lastSeenAt: device.lastSeenAt ?? '',
    }));
