import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  entityKeys,
  useCreateEntity,
  useEntities,
} from '@/features/entities/hooks/useEntities';

const entityApi = vi.hoisted(() => ({
  getEntities: vi.fn(),
  createEntity: vi.fn(),
}));

vi.mock('@/features/entities/api/entityApi', () => entityApi);

const ENTITY = { id: '1', name: 'Uno', createdAt: '2024-01-01T00:00:00Z' };

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useEntities', () => {
  beforeEach(() => {
    entityApi.getEntities.mockReset().mockResolvedValue([ENTITY]);
    entityApi.createEntity.mockReset();
  });

  it('pide la lista con los filtros y el signal de la query', async () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useEntities({ search: 'u' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([ENTITY]);
    expect(entityApi.getEntities).toHaveBeenCalledWith({ search: 'u' }, expect.any(AbortSignal));
  });

  it('guarda cada combinación de filtros bajo su propia llave', async () => {
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useEntities({ search: 'u' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(entityKeys.list({ search: 'u' }))).toEqual([ENTITY]);
    expect(queryClient.getQueryData(entityKeys.list({}))).toBeUndefined();
  });

  it('expone el error de api/', async () => {
    entityApi.getEntities.mockRejectedValue(new Error('fallo'));
    const { wrapper } = setup();

    const { result } = renderHook(() => useEntities(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateEntity', () => {
  it('crea la entidad e invalida las listas', async () => {
    entityApi.getEntities.mockReset().mockResolvedValue([ENTITY]);
    entityApi.createEntity.mockReset().mockResolvedValue({ ...ENTITY, id: '2' });
    const { wrapper } = setup();

    const { result } = renderHook(
      () => ({ list: useEntities(), create: useCreateEntity() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(entityApi.getEntities).toHaveBeenCalledTimes(1);

    await act(() => result.current.create.mutateAsync({ name: 'Dos' }));

    expect(entityApi.createEntity).toHaveBeenCalledWith({ name: 'Dos' });
    await waitFor(() => expect(entityApi.getEntities).toHaveBeenCalledTimes(2));
  });
});
