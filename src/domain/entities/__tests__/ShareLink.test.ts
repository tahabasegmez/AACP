import { parseShareUrl, shareUrl } from '../ShareLink';

const BASE = 'https://aacp-api.example.workers.dev';

describe('shareUrl', () => {
  it('bölüm adresi kurar', () => {
    expect(shareUrl(BASE, { kind: 'episode', showId: 'bir-bakista', episodeId: 'ep-1' })).toBe(
      `${BASE}/s/e/bir-bakista/ep-1`,
    );
  });

  it('şov adresi kurar', () => {
    expect(shareUrl(BASE, { kind: 'show', showId: 'bir-bakista' })).toBe(
      `${BASE}/s/p/bir-bakista`,
    );
  });

  it('kök adresteki sondaki eğik çizgiyi yutar', () => {
    expect(shareUrl(`${BASE}/`, { kind: 'show', showId: 'x' })).toBe(`${BASE}/s/p/x`);
  });

  it('kimlikleri kodlar — RSS guid’i her şey olabilir', () => {
    const url = shareUrl(BASE, {
      kind: 'episode',
      showId: 'sov',
      episodeId: 'https://media/a b?x=1',
    });

    expect(url).toBe(`${BASE}/s/e/sov/https%3A%2F%2Fmedia%2Fa%20b%3Fx%3D1`);
  });
});

describe('parseShareUrl', () => {
  it('https bölüm adresini çözer', () => {
    expect(parseShareUrl(`${BASE}/s/e/bir-bakista/ep-1`)).toEqual({
      kind: 'episode',
      showId: 'bir-bakista',
      episodeId: 'ep-1',
    });
  });

  it('https şov adresini çözer', () => {
    expect(parseShareUrl(`${BASE}/s/p/bir-bakista`)).toEqual({
      kind: 'show',
      showId: 'bir-bakista',
    });
  });

  it('özel şemayı da çözer (tanıtım sayfasının yönlendirmesi)', () => {
    expect(parseShareUrl('aacp://e/bir-bakista/ep-1')).toEqual({
      kind: 'episode',
      showId: 'bir-bakista',
      episodeId: 'ep-1',
    });
  });

  it('gidiş dönüş: kurulan adres aynen çözülür', () => {
    const target = {
      kind: 'episode' as const,
      showId: 'şov/çğü',
      episodeId: 'https://media/a b',
    };

    expect(parseShareUrl(shareUrl(BASE, target))).toEqual(target);
  });

  it('tanınmayan adres null döner — bozuk bağlantı hata ekranı göstermemeli', () => {
    expect(parseShareUrl(`${BASE}/baska/yol`)).toBeNull();
    expect(parseShareUrl('')).toBeNull();
    expect(parseShareUrl('saçmalık')).toBeNull();
  });

  it('eksik parçalı adres null döner', () => {
    expect(parseShareUrl(`${BASE}/s/e/yalniz-sov`)).toBeNull();
  });
});
