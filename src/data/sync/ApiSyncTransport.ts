import { ApiClient } from '@infrastructure/api';
import { SyncRecord } from './SyncTypes';
import { SyncTransport } from './SyncEngine';

interface PullResponse {
  readonly records?: SyncRecord[];
  readonly cursor?: number;
}

interface PushResponse {
  readonly cursor?: number;
}

/**
 * ApiSyncTransport — SyncTransport'un AACP backend implementasyonu.
 *
 * Motor ile ağ ayrıntılarını ayırır: farklı bir senkron sağlayıcısına
 * (ör. iCloud/CloudKit) geçilmek istenirse yalnızca bu sınıfın muadili yazılır.
 */
export class ApiSyncTransport implements SyncTransport {
  constructor(private readonly api: ApiClient) {}

  get enabled(): boolean {
    return this.api.enabled;
  }

  async pull(collection: string, since: number): Promise<{ records: SyncRecord[]; cursor: number }> {
    const response = await this.api.get<PullResponse>(
      `/v1/sync/${encodeURIComponent(collection)}?since=${since}`,
    );
    return {
      records: response?.records ?? [],
      cursor: response?.cursor ?? since,
    };
  }

  async push(collection: string, records: readonly SyncRecord[]): Promise<{ cursor: number }> {
    const response = await this.api.post<PushResponse>(
      `/v1/sync/${encodeURIComponent(collection)}`,
      { records },
    );
    return { cursor: response?.cursor ?? 0 };
  }
}
