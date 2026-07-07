import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';

import { useEntities, useCreateEntity } from '../../src/hooks/useEntities';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useCreateEntity', () => {
  it('invalidates the list query after a successful create', async () => {
    const { result } = renderHook(
      () => ({ list: useEntities(), create: useCreateEntity() }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const before = result.current.list.data!.length;

    await act(async () => {
      await result.current.create.mutateAsync({ name: 'Fourth Entity' });
    });

    // onSuccess invalidates the list -> the active query refetches with the new item.
    await waitFor(
      () => expect(result.current.list.data).toHaveLength(before + 1),
      { timeout: 3000 },
    );
  });
});
