import { Episode } from '@domain/entities';

/**
 * "Kaldığın yer" kaydının meta verisini KİMLİĞE GÖRE bulur.
 *
 * NEDEN GEREKLİ: kaydın kimliği OYNATICIDAN gelir (gerçekte yüklü olan parça),
 * gösterim meta'sı ise uygulamanın durumundan. İkisi kısa süreliğine
 * AYRIŞABİLİR — bir bölümden diğerine geçerken store yeni bölümü gösterirken
 * oynatıcı hâlâ eskisini tutar.
 *
 * O anda körlemesine "şu an açık olan bölüm"ün meta'sını yazmak, kaydı kalıcı
 * olarak ZEHİRLİYORDU: A bölümünün kaydı B'nin başlığını, kapağını ve
 * **audioUrl'ini** alıyordu. Sonuç "Dinlemeye devam"da aynı bölümün iki kez
 * görünmesi (iki farklı kimlik, aynı başlık) ve o satıra dokununca YANLIŞ
 * bölümün çalmasıydı. Depo alanları birleştirdiği için yanlış değer bir daha
 * kendiliğinden düzelmiyor.
 *
 * Bulunamazsa `undefined` döner: kayıt yalnızca konumla yazılır ve depo daha
 * önce doğru yazılmış meta'yı korur. Eksik meta, yanlış meta'dan iyidir.
 */
export const episodeForProgress = (
  episodeId: string,
  currentEpisode: Episode | null,
  queue: readonly Episode[],
): Episode | undefined =>
  currentEpisode?.id === episodeId
    ? currentEpisode
    : queue.find(episode => episode.id === episodeId);
