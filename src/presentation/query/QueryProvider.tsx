import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useRef } from 'react';
import { env } from '@core/config';

/**
 * QueryProvider — TanStack Query istemcisini uygulama ağacına sağlar.
 * Varsayılan cache/retry politikaları env'den beslenir.
 */
export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const clientRef = useRef<QueryClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: env.feedCacheTtlMs,
          retry: env.networkRetryCount,
          refetchOnWindowFocus: false,
        },
      },
    });
  }
  return (
    <QueryClientProvider client={clientRef.current}>
      {children}
    </QueryClientProvider>
  );
};
