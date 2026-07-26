import { Ad, AdBreak, AdPlacement, AdTrackingEvent } from '@domain/entities';

/**
 * VAST (Digital Video Ad Serving Template) → domain dönüşümü.
 *
 * VAST, sesli/görüntülü reklam sektörünün standardıdır (IAB). Uygulama yalnızca
 * ses reklamı çaldığı için gereken alt küme küçüktür:
 *   - `<Ad>` → `<InLine>` → `<Creatives>` → `<Linear>` → `<MediaFiles>`
 *   - `<Duration>`, `<TrackingEvents>`, `<Impression>`, `<VideoClicks>`
 *
 * Desteklenmeyen/eksik alanlar sessizce atlanır: reklam verinin bozukluğu
 * yüzünden dinleme deneyimi ASLA bozulmamalıdır. Ayrıştırılamayan bir reklam
 * "reklam yok" gibi ele alınır.
 *
 * VAST Wrapper (başka bir VAST'a yönlendiren yanıt) `vastWrapperUri()` ile
 * saptanır; zincir çözümü repository'de yapılır (ağ erişimi orada).
 */

/** Ses için tercih edilen MIME tipleri (öncelik sırasıyla). */
const AUDIO_MIME_PRIORITY = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/mp3'];

/** VAST olay adı → domain olayı. */
const EVENT_MAP: Readonly<Record<string, AdTrackingEvent>> = {
  start: 'start',
  firstQuartile: 'firstQuartile',
  midpoint: 'midpoint',
  thirdQuartile: 'thirdQuartile',
  complete: 'complete',
  skip: 'skip',
};

/** `<tag ...>içerik</tag>` bloklarını sırayla döndürür. */
const blocks = (xml: string, tag: string): string[] => {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    out.push(match[0]);
  }
  return out;
};

/** Bir bloğun iç metnini (CDATA çözülmüş) verir. */
const innerText = (block: string, tag: string): string | undefined => {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  if (!match) {
    return undefined;
  }
  const value = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  return value.length > 0 ? value : undefined;
};

/** Aynı isimli tüm etiketlerin iç metinlerini verir. */
const innerTexts = (xml: string, tag: string): string[] =>
  blocks(xml, tag)
    .map(block => innerText(block, tag))
    .filter((v): v is string => !!v);

/** Bir bloktaki öznitelik değerini verir. */
const attribute = (block: string, name: string): string | undefined => {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(block);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
};

/**
 * VAST süresini (`HH:MM:SS` veya `HH:MM:SS.mmm`) saniyeye çevirir.
 * Geçersizse 0 döner — süre bilinmiyorsa gerçek medya süresi kullanılır.
 */
export const parseVastDuration = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }
  const parts = value.split(':').map(p => Number.parseFloat(p));
  if (parts.some(p => Number.isNaN(p))) {
    return 0;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] ?? 0;
};

/**
 * Yanıt bir VAST Wrapper ise, izlenecek VASTAdTagURI'yi döner.
 * (Wrapper zincirleri reklam sunucuları arasında yönlendirme için kullanılır.)
 */
export const vastWrapperUri = (xml: string): string | undefined => {
  const wrapper = blocks(xml, 'Wrapper')[0];
  return wrapper ? innerText(wrapper, 'VASTAdTagURI') : undefined;
};

/** Bir `<Linear>` bloğundan en uygun ses dosyasını seçer. */
const pickMediaUrl = (linear: string): string | undefined => {
  const files = blocks(linear, 'MediaFile').map(block => ({
    url: innerText(block, 'MediaFile'),
    type: attribute(block, 'type')?.toLowerCase() ?? '',
    bitrate: Number(attribute(block, 'bitrate') ?? 0),
  }));

  const playable = files.filter(f => !!f.url);
  if (playable.length === 0) {
    return undefined;
  }

  // Ses tiplerini önceliğe göre ara; bulunamazsa ilk dosyaya düş.
  for (const mime of AUDIO_MIME_PRIORITY) {
    const match = playable.filter(f => f.type === mime);
    if (match.length > 0) {
      // Aynı tipte birden çok varsa en düşük bitrate: mobil veriyi korur.
      return match.sort((a, b) => (a.bitrate || 1e9) - (b.bitrate || 1e9))[0].url;
    }
  }
  return playable[0].url;
};

/** İzleme URL'lerini olay adına göre toplar. */
const collectTracking = (
  adBlock: string,
  linear: string,
): Ad['tracking'] => {
  const tracking: Partial<Record<AdTrackingEvent, string[]>> = {};

  const push = (event: AdTrackingEvent, url?: string): void => {
    if (!url) {
      return;
    }
    (tracking[event] ??= []).push(url);
  };

  // <Impression> — <InLine> seviyesinde.
  innerTexts(adBlock, 'Impression').forEach(url => push('impression', url));

  // <TrackingEvents><Tracking event="start">...
  for (const block of blocks(linear, 'Tracking')) {
    const name = attribute(block, 'event');
    const mapped = name ? EVENT_MAP[name] : undefined;
    if (mapped) {
      push(mapped, innerText(block, 'Tracking'));
    }
  }

  // <VideoClicks><ClickTracking>
  for (const clicks of blocks(linear, 'VideoClicks')) {
    innerTexts(clicks, 'ClickTracking').forEach(url => push('click', url));
  }

  // <Error>
  innerTexts(adBlock, 'Error').forEach(url => push('error', url));

  return tracking;
};

/** Tek bir `<Ad>` bloğunu domain reklamına çevirir; çalınamıyorsa null. */
const mapAd = (adBlock: string): Ad | null => {
  const linear = blocks(adBlock, 'Linear')[0];
  if (!linear) {
    return null; // yalnızca Linear (araya giren) reklam destekleniyor
  }

  const mediaUrl = pickMediaUrl(linear);
  if (!mediaUrl) {
    return null; // çalınabilir dosya yok → reklam yok sayılır
  }

  const clickUrl = blocks(linear, 'VideoClicks')
    .map(clicks => innerText(clicks, 'ClickThrough'))
    .find(Boolean);

  return {
    id: attribute(adBlock, 'id') ?? mediaUrl,
    mediaUrl,
    durationSec: parseVastDuration(innerText(linear, 'Duration')),
    title: innerText(adBlock, 'AdTitle'),
    advertiser: innerText(adBlock, 'Advertiser'),
    clickUrl,
    tracking: collectTracking(adBlock, linear),
  };
};

/**
 * VAST XML → AdBreak. Ayrıştırılamayan reklamlar atlanır; hiç geçerli reklam
 * yoksa `null` döner (çağıran bunu "reklam yok" olarak ele alır).
 *
 * Birden çok `<Ad>` bir "ad pod"dur; `sequence` özniteliğine göre sıralanır.
 */
export const mapVastToAdBreak = (xml: string, placement: AdPlacement): AdBreak | null => {
  const adBlocks = blocks(xml, 'Ad');
  if (adBlocks.length === 0) {
    return null;
  }

  const ads = adBlocks
    .map(block => ({ block, sequence: Number(attribute(block, 'sequence') ?? 0) }))
    .sort((a, b) => a.sequence - b.sequence)
    .map(({ block }) => mapAd(block))
    .filter((ad): ad is Ad => ad !== null);

  return ads.length > 0 ? { placement, ads } : null;
};
