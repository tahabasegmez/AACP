#!/usr/bin/env node
/**
 * Katalog aktarımını tetikler.
 *
 *   node scripts/import-catalog.mjs                      # hesaptaki tüm şovları keşfet
 *   node scripts/import-catalog.mjs <feedUrl> [feedUrl…] # yalnızca verilenleri aktar
 *
 * Gerekli ortam değişkenleri:
 *   API_URL      — Worker adresi (ör. https://aacp-api.<hesap>.workers.dev)
 *   ADMIN_TOKEN  — yönetim jetonu
 *
 * Bu betik yalnızca uçları ÇAĞIRIR; şov bilgisi sunucuda feed'den okunur.
 * Böylece aktarımın kuralları tek yerde (Worker) yaşar ve komut satırıyla
 * cron aynı davranışı gösterir.
 */

const apiUrl = (process.env.API_URL ?? '').replace(/\/+$/, '');
const adminToken = process.env.ADMIN_TOKEN ?? '';

if (!apiUrl || !adminToken) {
  console.error('API_URL ve ADMIN_TOKEN gerekli.');
  console.error('Örnek: API_URL=https://... ADMIN_TOKEN=... node scripts/import-catalog.mjs');
  process.exit(1);
}

const feedUrls = process.argv.slice(2);

const response = await fetch(`${apiUrl}/v1/catalog/import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
  body: JSON.stringify(feedUrls.length > 0 ? { feedUrls } : {}),
});

const body = await response.text();
if (!response.ok) {
  console.error(`Aktarım başarısız (${response.status}): ${body}`);
  process.exit(1);
}

const result = JSON.parse(body);
console.log(`Kaynak       : ${result.source === 'transistor' ? 'yayıncı hesabı' : 'verilen adresler'}`);
console.log(`Aktarılan    : ${result.imported.length}`);
result.imported.forEach(slug => console.log(`  ✓ ${slug}`));

if (result.failed.length > 0) {
  console.log(`Çözülemeyen  : ${result.failed.length}`);
  result.failed.forEach(url => console.log(`  ✗ ${url}`));
}
