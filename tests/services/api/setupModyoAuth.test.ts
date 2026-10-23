import { QueryClient } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { api } from '../../../src/services/api/client';
import { enableModyoAuth } from '../../../src/services/api/setupModyoAuth';
import type { ModyoProfile } from '../../../src/types';

/**
 * Cubre la línea de activación en sí: que `enableModyoAuth()` deje la instancia
 * base lista, no solo que las piezas funcionen por separado.
 *
 * Muta el singleton `api`, lo cual es correcto: es lo que hace en producción.
 * El registro de módulos de vitest es por archivo, así que no contamina otros.
 */
function profileClientStub(profile: ModyoProfile) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      get: vi.fn(async (url: string) => { calls.push(url); return { data: profile }; }),
    } as unknown as AxiosInstance,
  };
}

describe('enableModyoAuth', () => {
  it('deja api lista para mandar el token delegado y el idioma', async () => {
    const stub = profileClientStub({
      delegated_token: { access_token: 'tok-1', revalidate_in: 300 },
    });

    const session = enableModyoAuth({
      realm: 'retail',
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      profileClient: stub.client,
    });

    expect(session.profileUrl).toBe('/api/customers/realms/retail/me');

    // Se intercepta el adapter para observar la petición ya interceptada, sin
    // tocar la red.
    const sent: Array<Record<string, unknown>> = [];
    api.defaults.adapter = async (config) => {
      sent.push({
        authorization: config.headers.get?.('Authorization'),
        acceptLanguage: config.headers.get?.('Accept-Language'),
      });
      return {
        data: {}, status: 200, statusText: 'OK', headers: {}, config,
      };
    };

    await api.get('/entities');
    await api.get('/entities');

    expect(sent).toHaveLength(2);
    expect(sent[0].authorization).toBe('Bearer tok-1');
    expect(sent[0].acceptLanguage).toBeTruthy();
    // Dos peticiones, un solo /me: el cache de la sesión quedó enchufado.
    expect(stub.calls).toEqual(['/api/customers/realms/retail/me']);
  });
});
