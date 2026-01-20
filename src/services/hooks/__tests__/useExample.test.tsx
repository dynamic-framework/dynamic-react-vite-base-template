/**
 * Template de test para hooks con TanStack Query
 *
 * Renombrar este archivo según el hook que se esté testeando:
 * - useAccounts.ts -> useAccounts.test.tsx
 * - useTransactions.ts -> useTransactions.test.tsx
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
/* eslint-enable @typescript-eslint/no-unused-vars */

// TODO: Importar el hook real
// import { useAccounts } from '../useAccounts';

// Wrapper con QueryClient configurado para tests
const _createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
      staleTime: 0,
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _createWrapper = () => {
  const queryClient = _createTestQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useExample', () => {
  it('should return loading state initially', () => {
    // TODO: Reemplazar con hook real
    // const { result } = renderHook(() => useAccounts(), {
    //   wrapper: _createWrapper(),
    // });
    // expect(result.current.isLoading).toBe(true);

    expect(true).toBe(true); // Placeholder - reemplazar con test real
  });

  it('should return data after loading', async () => {
    // TODO: Implementar test real
    // const { result } = renderHook(() => useAccounts(), {
    //   wrapper: _createWrapper(),
    // });
    // await waitFor(() => {
    //   expect(result.current.isLoading).toBe(false);
    // });
    // expect(result.current.data).toBeDefined();

    expect(true).toBe(true); // Placeholder - reemplazar con test real
  });
});
