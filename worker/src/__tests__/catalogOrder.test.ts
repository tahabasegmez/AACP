import { describe, expect, it } from 'vitest';
import { byFreshness, type ShowRow } from '../routes/catalog';

/** Sıralamayı ilgilendiren alanlar dışındakiler testte gürültüdür. */
const show = (
  slug: string,
  lastPublished?: string,
  sortOrder = 0,
): ShowRow => ({
  slug,
  feed_url: `https://feeds.transistor.fm/${slug}`,
  title: slug,
  description: null,
  image_url: null,
  author: null,
  language: null,
  categories: null,
  active: true,
  sort_order: sortOrder,
  episodes: lastPublished === undefined ? [] : [{ published_at: lastPublished }],
});

const order = (rows: ShowRow[]): string[] => [...rows].sort(byFreshness).map(r => r.slug);

describe('byFreshness', () => {
  it('en son yayınlanan şovu üste alır', () => {
    expect(
      order([
        show('eski', '2026-01-01T00:00:00Z'),
        show('yeni', '2026-08-01T00:00:00Z'),
        show('orta', '2026-05-01T00:00:00Z'),
      ]),
    ).toEqual(['yeni', 'orta', 'eski']);
  });

  it('bölümü olmayan şovu sona atar', () => {
    // Yeni eklenmiş ve henüz taranmamış şov listenin tepesini kapmamalı.
    expect(order([show('taranmamis'), show('dolu', '2026-01-01T00:00:00Z')])).toEqual([
      'dolu',
      'taranmamis',
    ]);
  });

  it('çözülemeyen tarihi bölümü yokmuş gibi sayar', () => {
    expect(order([show('bozuk', 'tarih değil'), show('dolu', '2020-01-01T00:00:00Z')])).toEqual([
      'dolu',
      'bozuk',
    ]);
  });

  it('sort_order tazeliği EZER (yönetim kancası)', () => {
    // Varsayılan 0 bırakıldığında etkisizdir; bir şovu tepeye sabitlemek
    // gerektiğinde tek satırla yapılır.
    expect(
      order([
        show('taze', '2026-08-01T00:00:00Z'),
        show('sabitli', '2020-01-01T00:00:00Z', -1),
      ]),
    ).toEqual(['sabitli', 'taze']);
  });

  it('eşit tazelikte başlığa göre kararlı sıralar', () => {
    // Aynı anda yayınlanan iki şovun sırası turdan tura oynamamalı.
    const same = '2026-08-01T00:00:00Z';
    expect(order([show('çilek', same), show('armut', same)])).toEqual(['armut', 'çilek']);
  });
});
