/**
 * The widget's QueryClient, as its own module.
 *
 * Separate from `QueryProvider.tsx` so service-layer code (the Modyo session,
 * for one) can import the cache without pulling in React and the devtools.
 * There must be exactly one instance: two caches mean two `/me` calls, which
 * defeats the deduplication the session relies on.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutos
      retry: 1,
      refetchOnWindowFocus: false,   // Desactivado para widgets embebidos
    },
  },
});
