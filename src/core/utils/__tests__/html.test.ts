import { stripHtml } from '../html';

describe('stripHtml', () => {
  it('etiketleri temizler ve boşlukları sadeleştirir', () => {
    expect(stripHtml('<p>Merhaba   <b>dünya</b></p>')).toBe('Merhaba dünya');
  });

  it('yaygın HTML entity\'lerini çözer', () => {
    expect(stripHtml('AA &amp; ortaklar&#39;ı')).toBe("AA & ortaklar'ı");
  });

  it('boş/temiz metni korur', () => {
    expect(stripHtml('düz metin')).toBe('düz metin');
  });
});
