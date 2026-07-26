import { mapVastToAdBreak, parseVastDuration, vastWrapperUri } from '../vastMapper';

const inlineVast = (opts?: { duration?: string; mime?: string }): string => `<?xml version="1.0"?>
<VAST version="4.0">
  <Ad id="reklam-1">
    <InLine>
      <AdTitle>Marka Tanıtımı</AdTitle>
      <Advertiser>Örnek Marka</Advertiser>
      <Impression><![CDATA[https://izleme.example.com/imp]]></Impression>
      <Error><![CDATA[https://izleme.example.com/err]]></Error>
      <Creatives>
        <Creative>
          <Linear>
            <Duration>${opts?.duration ?? '00:00:30'}</Duration>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[https://izleme.example.com/start]]></Tracking>
              <Tracking event="midpoint"><![CDATA[https://izleme.example.com/mid]]></Tracking>
              <Tracking event="complete"><![CDATA[https://izleme.example.com/done]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[https://marka.example.com]]></ClickThrough>
              <ClickTracking><![CDATA[https://izleme.example.com/click]]></ClickTracking>
            </VideoClicks>
            <MediaFiles>
              <MediaFile type="${opts?.mime ?? 'audio/mpeg'}" bitrate="128">
                <![CDATA[https://cdn.example.com/reklam.mp3]]>
              </MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;

describe('parseVastDuration', () => {
  it('HH:MM:SS biçimini saniyeye çevirir', () => {
    expect(parseVastDuration('00:00:30')).toBe(30);
    expect(parseVastDuration('00:01:15')).toBe(75);
    expect(parseVastDuration('01:00:00')).toBe(3600);
  });

  it('ondalıklı saniyeyi destekler', () => {
    expect(parseVastDuration('00:00:15.500')).toBe(15.5);
  });

  it('geçersiz/boş değerde 0 döner', () => {
    expect(parseVastDuration(undefined)).toBe(0);
    expect(parseVastDuration('abc')).toBe(0);
  });
});

describe('vastWrapperUri', () => {
  it('Wrapper yanıtındaki hedef adresi döner', () => {
    const xml = `<VAST><Ad><Wrapper>
      <VASTAdTagURI><![CDATA[https://baska.example.com/vast]]></VASTAdTagURI>
    </Wrapper></Ad></VAST>`;
    expect(vastWrapperUri(xml)).toBe('https://baska.example.com/vast');
  });

  it('InLine yanıtta undefined döner', () => {
    expect(vastWrapperUri(inlineVast())).toBeUndefined();
  });
});

describe('mapVastToAdBreak', () => {
  it('InLine reklamı domain modeline çevirir', () => {
    const result = mapVastToAdBreak(inlineVast(), 'postroll');

    expect(result).not.toBeNull();
    expect(result!.placement).toBe('postroll');
    expect(result!.ads).toHaveLength(1);

    const ad = result!.ads[0];
    expect(ad.id).toBe('reklam-1');
    expect(ad.mediaUrl).toBe('https://cdn.example.com/reklam.mp3');
    expect(ad.durationSec).toBe(30);
    expect(ad.title).toBe('Marka Tanıtımı');
    expect(ad.advertiser).toBe('Örnek Marka');
    expect(ad.clickUrl).toBe('https://marka.example.com');
  });

  it('izleme URL\'lerini olaylara göre toplar', () => {
    const ad = mapVastToAdBreak(inlineVast(), 'postroll')!.ads[0];

    expect(ad.tracking.impression).toEqual(['https://izleme.example.com/imp']);
    expect(ad.tracking.start).toEqual(['https://izleme.example.com/start']);
    expect(ad.tracking.midpoint).toEqual(['https://izleme.example.com/mid']);
    expect(ad.tracking.complete).toEqual(['https://izleme.example.com/done']);
    expect(ad.tracking.click).toEqual(['https://izleme.example.com/click']);
    expect(ad.tracking.error).toEqual(['https://izleme.example.com/err']);
  });

  it('birden çok reklamı sequence sırasına göre dizer (ad pod)', () => {
    const xml = `<VAST>
      <Ad id="ikinci" sequence="2"><InLine><Creatives><Creative><Linear>
        <Duration>00:00:10</Duration>
        <MediaFiles><MediaFile type="audio/mpeg">https://cdn/2.mp3</MediaFile></MediaFiles>
      </Linear></Creative></Creatives></InLine></Ad>
      <Ad id="birinci" sequence="1"><InLine><Creatives><Creative><Linear>
        <Duration>00:00:05</Duration>
        <MediaFiles><MediaFile type="audio/mpeg">https://cdn/1.mp3</MediaFile></MediaFiles>
      </Linear></Creative></Creatives></InLine></Ad>
    </VAST>`;

    const result = mapVastToAdBreak(xml, 'postroll');
    expect(result!.ads.map(a => a.id)).toEqual(['birinci', 'ikinci']);
  });

  it('çalınabilir dosyası olmayan reklamı atlar', () => {
    const xml = `<VAST><Ad id="bos"><InLine><Creatives><Creative><Linear>
      <Duration>00:00:30</Duration>
      <MediaFiles></MediaFiles>
    </Linear></Creative></Creatives></InLine></Ad></VAST>`;

    expect(mapVastToAdBreak(xml, 'postroll')).toBeNull();
  });

  it('reklam içermeyen yanıtta null döner (boş VAST)', () => {
    expect(mapVastToAdBreak('<VAST version="4.0"></VAST>', 'postroll')).toBeNull();
  });

  it('bozuk XML uygulamayı düşürmez, null döner', () => {
    expect(mapVastToAdBreak('<VAST><Ad><kirik', 'postroll')).toBeNull();
  });

  it('birden çok ses dosyasından en düşük bitrate\'i seçer (mobil veri)', () => {
    const xml = `<VAST><Ad id="a"><InLine><Creatives><Creative><Linear>
      <Duration>00:00:30</Duration>
      <MediaFiles>
        <MediaFile type="audio/mpeg" bitrate="320">https://cdn/yuksek.mp3</MediaFile>
        <MediaFile type="audio/mpeg" bitrate="64">https://cdn/dusuk.mp3</MediaFile>
      </MediaFiles>
    </Linear></Creative></Creatives></InLine></Ad></VAST>`;

    const ad = mapVastToAdBreak(xml, 'postroll')!.ads[0];
    expect(ad.mediaUrl).toBe('https://cdn/dusuk.mp3');
  });
});
