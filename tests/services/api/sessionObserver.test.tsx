/**
 * La sesión vista desde un observador montado (`useProfile()`).
 *
 * Es el escenario donde `removeQueries` fallaba: destruye el objeto query y el
 * observador se queda enganchado al destruido, así que el hook seguía pintando
 * el perfil anterior al 401 indefinidamente. Y la alternativa obvia
 * (`invalidateQueries` por defecto) refetchea a los observadores activos al
 * instante, que es el `/me` de fondo que este módulo no debe generar nunca.
 */
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { AxiosInstance } from 'axios';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createModyoSession, type ModyoSession } from '../../../src/services/api/modyoSession';

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let n = 0;
  const client = {
    get: vi.fn(async () => {
      n += 1;
      return {
        data: {
          username: `u-${n}`,
          delegated_token: { access_token: `tok-${n}`, revalidate_in: 300 },
        },
      };
    }),
  } as unknown as AxiosInstance;

  const session = createModyoSession({ realm: 'retail', queryClient, profileClient: client });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { session, wrapper, calls: () => n };
}

/** Monta el equivalente a `useProfile()` y espera al primer perfil. */
async function mountProfile(session: ModyoSession, wrapper: ReturnType<typeof setup>['wrapper']) {
  const { result } = renderHook(() => useQuery(session.queryOptions), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result;
}

describe('sesión con useProfile() montado', () => {
  it('el hook ve el perfil renovado tras un 401', async () => {
    const { session, wrapper, calls } = setup();
    const result = await mountProfile(session, wrapper);

    expect(result.current.data?.username).toBe('u-1');

    // Lo que hace el reintento de 401.
    session.invalidateAccessToken('tok-1');
    expect(await session.getAccessToken()).toBe('tok-2');

    await waitFor(() => expect(result.current.data?.username).toBe('u-2'));
    expect(calls()).toBe(2);
  });

  it('invalidar no dispara por sí solo ningún /me', async () => {
    // La invariante del keepalive: con `refetchType: 'active'` (el defecto),
    // esto refetchearía al instante y el módulo mantendría viva la sesión.
    const { session, wrapper, calls } = setup();
    await mountProfile(session, wrapper);
    expect(calls()).toBe(1);

    session.invalidateAccessToken('tok-1');

    // Margen generoso para que cualquier refetch de fondo tenga tiempo de salir.
    await new Promise((resolve) => { setTimeout(resolve, 150); });
    expect(calls()).toBe(1);

    // Y cuando alguien lo pide de verdad, sí se busca.
    expect(await session.getAccessToken()).toBe('tok-2');
    expect(calls()).toBe(2);
  });

  it('el perfil sigue disponible mientras se renueva, no parpadea a undefined', async () => {
    // Efecto lateral util de invalidar en vez de borrar: el hook conserva el
    // ultimo perfil bueno, en vez de quedarse sin datos durante el refetch.
    const { session, wrapper } = setup();
    const result = await mountProfile(session, wrapper);

    session.invalidateAccessToken('tok-1');

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.username).toBe('u-1');
  });

  it('el guard de estampida sigue funcionando con el perfil aún en cache', async () => {
    const { session, wrapper, calls } = setup();
    await mountProfile(session, wrapper);

    session.invalidateAccessToken('tok-1');
    expect(await session.getAccessToken()).toBe('tok-2');

    // Segundo 401 que traia el token viejo: no debe tirar tok-2.
    session.invalidateAccessToken('tok-1');
    expect(await session.getAccessToken()).toBe('tok-2');
    expect(calls()).toBe(2);
  });
});
