#!/usr/bin/env node
/**
 * generate-shows-json — bundled katalogdan (`src/core/config/feedCatalog.ts`)
 * sunucuya yüklenecek `shows.json` dosyasını üretir.
 *
 * Neden: katalog TEK kaynakta (TypeScript) yaşasın; sunucudaki JSON elle
 * kopyalanarak sürüklenmesin. Böylece bundled fallback ile yayınlanan katalog
 * kolayca eşitlenir (bkz. docs/REMOTE_CONFIG.md).
 *
 * Kullanım:
 *   node scripts/generate-shows-json.js [çıktı-yolu]
 *   node scripts/generate-shows-json.js shows.json
 *
 * Yayınlama (API ayaktayken):
 *   curl -X POST https://<worker-adresi>/v1/catalog \
 *        -H "x-admin-token: $ADMIN_TOKEN" \
 *        -H "Content-Type: application/json" \
 *        --data @shows.json
 *
 * Ayrıntı: docs/CLOUDFLARE-SUPABASE-KURULUM.md
 */
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', 'src', 'core', 'config', 'feedCatalog.ts');
const outputPath = process.argv[2] ?? path.join(__dirname, '..', 'shows.json');

/**
 * feedCatalog.ts içindeki FEED_CATALOG dizisini okur.
 *
 * Dosya TypeScript olduğu için doğrudan require edilemez; dizi literalini
 * ayıklayıp `feed(slug)` yardımcısını çözerek değerlendiriyoruz. Kaynak dosya
 * saf veri (yan etkisiz literal) olduğu için bu güvenlidir.
 */
const readCatalog = () => {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const start = source.indexOf('FEED_CATALOG');
  if (start === -1) {
    throw new Error('FEED_CATALOG bulunamadı — feedCatalog.ts değişmiş olabilir');
  }
  const arrayStart = source.indexOf('[', start);
  const arrayEnd = source.lastIndexOf('];');
  if (arrayStart === -1 || arrayEnd === -1) {
    throw new Error('FEED_CATALOG dizisi ayrıştırılamadı');
  }

  const literal = source.slice(arrayStart, arrayEnd + 1);
  const feed = slug => `https://feeds.transistor.fm/${slug}`;
  // eslint-disable-next-line no-new-func
  return new Function('feed', `return ${literal};`)(feed);
};

const main = () => {
  const entries = readCatalog();
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Katalog boş — yayınlamak tüm şovları gizlerdi');
  }

  const normalized = entries.map(e => ({
    slug: e.slug,
    feedUrl: e.feedUrl,
    title: e.title,
    ...(e.imageUrl ? { imageUrl: e.imageUrl } : {}),
    ...(e.description ? { description: e.description } : {}),
  }));

  const missing = normalized.filter(e => !e.slug || !e.feedUrl || !e.title);
  if (missing.length > 0) {
    throw new Error(`Eksik alanlı ${missing.length} giriş var (slug/feedUrl/title zorunlu)`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  process.stdout.write(`${normalized.length} şov yazıldı → ${outputPath}\n`);
};

main();
