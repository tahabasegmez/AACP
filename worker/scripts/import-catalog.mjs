#!/usr/bin/env node
/**
 * Katalog aktarımını tetikler.
 *
 *   npm run catalog:import                      # hesaptaki tüm şovları keşfet
 *   npm run catalog:import <feedUrl> [feedUrl…] # yalnızca verilenleri aktar
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

console.log(`Kaynak      : ${result.source === 'transistor' ? 'yayıncı hesabı' : 'verilen adresler'}`);
console.log(`Aktarılan   : ${result.imported.length}`);
result.imported.forEach(slug => console.log(`  ✓ ${slug}`));

if (result.failed.length > 0) {
  console.log(`Çözülemeyen : ${result.failed.length}`);
  result.failed.forEach(url => console.log(`  ✗ ${url}`));
}

// Keşif, sunucuda TRANSISTOR_API_KEY tanımlı değilse boş döner. Sessizce
// "0 aktarıldı" demek başarı gibi okunurdu; sebebi söylemek gerekir.
if (result.imported.length === 0 && result.failed.length === 0 && result.source === 'transistor') {
  console.log('\nHiçbir şov keşfedilemedi. Sunucuda TRANSISTOR_API_KEY tanımlı mı?');
  console.log('  npx wrangler secret put TRANSISTOR_API_KEY');
  console.log('Alternatif: feed adreslerini doğrudan verin —');
  console.log('  npm run catalog:import https://feeds.transistor.fm/<slug>');
}
