import { useEffect, useState } from 'react';

/**
 * useDebounced — bir değerin "durulmuş" halini döner.
 *
 * Arama kutularında kullanılır: kullanıcı yazarken her tuş vuruşunda sorgu
 * çalıştırmak hem gereksiz iş hem de titrek bir liste demektir. Değer belirtilen
 * süre boyunca değişmezse yeni değer yayınlanır.
 */
export const useDebounced = <T>(value: T, delayMs = 300): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
