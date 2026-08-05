import { TemplateStack } from '../templateStack';

describe('TemplateStack', () => {
  it('kökte boştur', () => {
    const stack = new TemplateStack();
    expect(stack.depth).toBe(0);
    expect(stack.top()).toBeUndefined();
  });

  it('itilen şablon tepeye gelir', () => {
    const stack = new TemplateStack();
    stack.pushed('list');
    stack.pushed('nowplaying');
    expect(stack.top()).toBe('nowplaying');
    expect(stack.contains('list')).toBe(true);
  });

  it('geri dönülen şablonun üstündekiler düşer', () => {
    const stack = new TemplateStack();
    stack.pushed('nowplaying');
    stack.pushed('upnext');
    stack.poppedTo('nowplaying');
    expect(stack.top()).toBe('nowplaying');
    expect(stack.contains('upnext')).toBe(false);
  });

  it('kök sekme görününce yığın boşalır', () => {
    // Kullanıcının "geri" tuşunu öğrenebileceğimiz tek kanal budur.
    const stack = new TemplateStack();
    stack.pushed('list');
    stack.pushed('nowplaying');
    stack.didAppear('tab-1', true);
    expect(stack.depth).toBe(0);
  });

  it('bilinen şablon görününce üstündekiler düşer', () => {
    const stack = new TemplateStack();
    stack.pushed('list');
    stack.pushed('nowplaying');
    stack.didAppear('list', false);
    expect(stack.top()).toBe('list');
    expect(stack.contains('nowplaying')).toBe(false);
  });

  it('sistemin kendi açtığı şablon modele EKLENİR', () => {
    // Yok saymak, bir sonraki itişimizi iOS istisnasına çevirirdi: aynı
    // şablon yığına iki kez eklenemez.
    const stack = new TemplateStack();
    stack.didAppear('nowplaying', false);
    expect(stack.contains('nowplaying')).toBe(true);
    expect(stack.top()).toBe('nowplaying');
  });

  it('yığında olmayan şablona dönüş isteği modeli bozmaz', () => {
    const stack = new TemplateStack();
    stack.pushed('list');
    stack.poppedTo('yok');
    expect(stack.top()).toBe('list');
  });

  it('bağlantı kopunca temizlenir', () => {
    const stack = new TemplateStack();
    stack.pushed('list');
    stack.clear();
    expect(stack.depth).toBe(0);
  });
});
