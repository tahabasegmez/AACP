#!/usr/bin/env node
/**
 * Katalog aktarımını tetikler.
 *
 *   npm run catalog:import <feedUrl> [feedUrl…] # şov ekle / verilenleri aktar
 *   npm run catalog:import                      # katalogdakilerin bilgisini tazele
 *
 * Yapılandırma (`API_URL`, `ADMIN_TOKEN`): ortam değişkeni ya da
 * `worker/.dev.vars` — bkz. admin.mjs.
 *
 * Bu betik yalnızca ucu ÇAĞIRIR; şov bilgisi sunucuda feed'den okunur.
 * Böylece aktarımın kuralları tek yerde (Worker) yaşar ve komut satırıyla
 * cron aynı davranışı gösterir.
 */
import { adminPost } from './admin.mjs';

const feedUrls = process.argv.slice(2);
const result = await adminPost('/v1/catalog/import', feedUrls.length > 0 ? { feedUrls } : {});

console.log(
  `Kaynak      : ${result.source === 'catalog' ? 'katalogdaki şovlar' : 'verilen adresler'}`,
);
console.log(`Aktarılan   : ${result.imported.length}`);
result.imported.forEach(slug => console.log(`  ✓ ${slug}`));

if (result.failed.length > 0) {
  console.log(`Çözülemeyen : ${result.failed.length}`);
  result.failed.forEach(url => console.log(`  ✗ ${url}`));
}

// Boş katalogda argümansız çağrı hiçbir şey yapmaz; "0 aktarıldı" başarı gibi
// okunurdu, sebebi söylemek gerekir.
if (result.imported.length === 0 && result.failed.length === 0 && result.source === 'catalog') {
  console.log('\nKatalog boş — tazelenecek şov yok. Feed adresi vererek ekleyin:');
  console.log('  npm run catalog:import https://feeds.ornek.fm/<slug>');
}
