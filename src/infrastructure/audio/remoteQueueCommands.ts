/**
 * Uzaktan kuyruk komutları köprüsü.
 *
 * SORUN: "sonraki/önceki bölüm" komutları CarPlay'den, kilit ekranından ve
 * direksiyon tuşlarından gelir ve `playbackService` (arka plan servisi)
 * tarafından karşılanır. Ama hangi bölümün sıradaki olduğunu KUYRUK bilir ve
 * kuyruk presentation katmanında yaşar — infrastructure oraya bağımlı olamaz
 * (katman yönü tersine dönerdi).
 *
 * ÇÖZÜM: burada yalnızca bir SÖZLEŞME durur. Uygulama açılışında app katmanı
 * gerçek işleyicileri kaydeder; `playbackService` onları çağırır ve kuyruğun
 * nerede yaşadığını bilmez.
 *
 * Kaydedilmediğinde komutlar sessizce yok sayılır: tek bölüm çalarken
 * "sonraki" demek anlamsızdır ve hata üretmemelidir.
 */
export interface RemoteQueueHandlers {
  /** Kuyrukta sonraki bölüme geçer. */
  next(): void;
  /**
   * Önceki bölüme geçer. Bölümün başına yakın değilse başa sarmak da geçerli
   * bir davranıştır; kararı işleyici verir (uygulamadaki kuralla aynı).
   */
  previous(): void;
}

const noop: RemoteQueueHandlers = {
  next: () => undefined,
  previous: () => undefined,
};

let handlers: RemoteQueueHandlers = noop;

/** Gerçek işleyicileri bağlar (app katmanı, açılışta çağırır). */
export const setRemoteQueueHandlers = (next?: RemoteQueueHandlers): void => {
  handlers = next ?? noop;
};

/** Arka plan servisinin kullandığı erişim noktası. */
export const remoteQueueHandlers = (): RemoteQueueHandlers => handlers;
