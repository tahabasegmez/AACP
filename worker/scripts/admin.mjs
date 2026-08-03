/**
 * Yönetim betikleri için ortak yapılandırma ve istek yardımcısı.
 *
 * Jeton NEDEN BURADA: `ADMIN_TOKEN` uygulamanın kök `.env` dosyasında
 * DURMAMALIDIR — react-native-config oradaki her değişkeni derlenen IPA'ya
 * gömer ve yönetim jetonu uygulamayla birlikte dağıtılırdı. Jetonun yeri
 * `worker/.dev.vars`'tır (git'e girmez, wrangler de aynı dosyayı okur).
 *
 * Öncelik: ortam değişkeni > worker/.dev.vars. Böylece CI değeri kabuktan
 * verebilir, geliştirici hiçbir şey yapıştırmadan çalıştırabilir.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_VARS = join(dirname(dirname(fileURLToPath(import.meta.url))), '.dev.vars');

/** `.dev.vars` dosyasını okur; yoksa boş döner (ortam değişkeni yeter). */
const readDevVars = () => {
  let content;
  try {
    content = readFileSync(DEV_VARS, 'utf8');
  } catch {
    return {};
  }

  return Object.fromEntries(
    content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .map(line => {
        const separator = line.indexOf('=');
        return separator === -1
          ? null
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
      .filter(entry => entry !== null),
  );
};

/** API adresini ve yönetim jetonunu çözer; eksikse süreci anlaşılır biçimde bitirir. */
export const adminConfig = () => {
  const devVars = readDevVars();
  const apiUrl = (process.env.API_URL ?? devVars.API_URL ?? '').replace(/\/+$/, '');
  const adminToken = process.env.ADMIN_TOKEN ?? devVars.ADMIN_TOKEN ?? '';

  if (!apiUrl || !adminToken) {
    console.error('API_URL ve ADMIN_TOKEN gerekli.');
    console.error(`Ortam değişkeni olarak verin ya da ${DEV_VARS} dosyasına yazın.`);
    process.exit(1);
  }
  return { apiUrl, adminToken };
};

/** Yönetim ucuna POST atar; hatayı gövdesiyle birlikte bildirir. */
export const adminPost = async (path, body) => {
  const { apiUrl, adminToken } = adminConfig();

  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(body ?? {}),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`İstek başarısız (${response.status}): ${text}`);
    process.exit(1);
  }
  return JSON.parse(text);
};
