#!/usr/bin/env node
/**
 * Bölüm arşivini doldurur — feed'lerdeki TÜM bölümleri veritabanına işler.
 *
 *   npm run episodes:backfill
 *
 * NE ZAMAN: yeni bir şov kataloga girdiğinde bir kez. Rutin cron turu bunu
 * yapmaz ve yapmamalıdır — arşivler büyüktür (tek şovda 1900+ bölüm) ve
 * yarım saatte bir baştan işlemek hiç değişmemiş binlerce satırı boşuna
 * yeniden yazmak olurdu. Cron yalnızca en yeni bölümlere bakar.
 *
 * Yapılandırma (`API_URL`, `ADMIN_TOKEN`): ortam değişkeni ya da
 * `worker/.dev.vars` — bkz. admin.mjs.
 */
import { adminPost } from './admin.mjs';

const result = await adminPost('/v1/push/scan', { backfill: true });

console.log(`Şov        : ${result.checked}`);
console.log(`İşlenen    : ${result.ingested} bölüm`);
console.log(`Bildirim   : ${result.notified}`);
