/**
 * Prettier yapılandırması.
 *
 * Değerler kod tabanının MEVCUT stilini tarif eder; araç çalıştırıldığında
 * ilgisiz binlerce satırı yeniden biçimlendirmemesi için:
 *  - `bracketSameLine`: JSX kapanış `>` işareti son özelliğin satırında kalır,
 *  - `printWidth`: 100, dosyalardaki fiili satır uzunluğu.
 * Eksik olduklarında Prettier kendi varsayılanlarını uygular ve dokunduğu her
 * dosya çevresindekilerden farklı görünürdü.
 */
module.exports = {
  arrowParens: 'avoid',
  singleQuote: true,
  trailingComma: 'all',
  bracketSameLine: true,
  printWidth: 100,
};
