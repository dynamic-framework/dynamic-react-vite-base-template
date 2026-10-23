import { QueryClient } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildProfileUrl,
  computeSessionStaleTimeMs,
  createModyoSession,
  createSessionQueryOptions,
  FALLBACK_TOKEN_TTL_SECONDS,
  SESSION_MIN_STALE_TIME_MS,
  SESSION_SAFETY_MARGIN_SECONDS,
  SessionError,
  withoutTrailingSlash,
} from '../../../src/services/api/modyoSession';
import type { ModyoProfile } from '../../../src/types';

/** Profile client stub that counts calls and lets the test control resolution. */
function makeProfileClient(profiles: ModyoProfile[]) {
  const calls: string[] = [];
  let resolveNext: ((value: unknown) => void) | undefined;
  const gate = () => new Promise((resolve) => { resolveNext = resolve; });

  const client = {
    get: vi.fn(async (url: string) => {
      calls.push(url);
      if (resolveNext === undefined && gated) {
        await gate();
      }
      const profile = profiles[Math.min(calls.length - 1, profiles.length - 1)];
      return { data: profile };
    }),
  } as unknown as AxiosInstance;

  let gated = false;
  return {
    client,
    calls,
    hold: () => { gated = true; },
    release: () => { resolveNext?.(undefined); resolveNext = undefined; gated = false; },
  };
}

function profileWith(token: string, extra: Record<string, unknown> = {}): ModyoProfile {
  return { delegated_token: { access_token: token, ...extra } };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('buildProfileUrl', () => {
  it('construye la ruta del realm', () => {
    expect(buildProfileUrl('retail')).toBe('/api/customers/realms/retail/me');
  });

  it('no duplica la barra con un portal absoluto', () => {
    expect(buildProfileUrl('retail', 'https://host/')).toBe('https://host/api/customers/realms/retail/me');
  });

  it('exige realm, porque `default` apunta a otro sitio', () => {
    expect(() => buildProfileUrl('')).toThrow(SessionError);
  });

  it('withoutTrailingSlash recorta todas las barras', () => {
    expect(withoutTrailingSlash('https://host///')).toBe('https://host');
    expect(withoutTrailingSlash('')).toBe('');
  });
});

describe('computeSessionStaleTimeMs', () => {
  const margenMs = SESSION_SAFETY_MARGIN_SECONDS * 1000;
  /** Momento de la respuesta de /me: el ancla desde la que mide TanStack Query. */
  const FETCH = 1_000_000;

  it('usa revalidate_in, que ya es la vida restante', () => {
    expect(computeSessionStaleTimeMs({ access_token: 't', revalidate_in: 300 }, FETCH))
      .toBe(300_000 - margenMs);
  });

  it('se queda con el menor de los límites disponibles', () => {
    const stale = computeSessionStaleTimeMs({
      access_token: 't',
      revalidate_in: 300,
      access_token_expires_in: 120,
    }, FETCH);
    expect(stale).toBe(120_000 - margenMs);
  });

  it('acota con la expiración absoluta cuando es más cercana', () => {
    const stale = computeSessionStaleTimeMs({
      access_token: 't',
      revalidate_in: 300,
      access_token_expires_in_datetime: new Date(FETCH + 60_000).toISOString(),
    }, FETCH);
    expect(stale).toBe(60_000 - margenMs);
  });

  it('mide la expiración absoluta desde el fetch, no desde ahora', () => {
    // La regresión: con el ancla en Date.now() se contaba dos veces la edad del
    // cache, porque TanStack Query ya mide desde dataUpdatedAt.
    const token = {
      access_token: 't',
      access_token_expires_in_datetime: new Date(FETCH + 300_000).toISOString(),
    };

    // El mismo token, evaluado en dos momentos distintos, tiene que dar el mismo
    // staleTime: es una vida desde el fetch, no la vida restante.
    expect(computeSessionStaleTimeMs(token, FETCH)).toBe(300_000 - margenMs);
    expect(computeSessionStaleTimeMs(token, FETCH)).toBe(300_000 - margenMs);
  });

  it('aplica el TTL por defecto si /me no manda ningún campo de tiempo', () => {
    expect(computeSessionStaleTimeMs({ access_token: 't' }, FETCH))
      .toBe((FALLBACK_TOKEN_TTL_SECONDS - SESSION_SAFETY_MARGIN_SECONDS) * 1000);
  });

  it('nunca baja del piso, para no entrar en bucle de refetch', () => {
    expect(computeSessionStaleTimeMs({ access_token: 't', revalidate_in: 1 }, FETCH))
      .toBe(SESSION_MIN_STALE_TIME_MS);
    expect(computeSessionStaleTimeMs({ access_token: 't', revalidate_in: -100 }, FETCH))
      .toBe(SESSION_MIN_STALE_TIME_MS);
  });

  it('sin token devuelve el piso', () => {
    expect(computeSessionStaleTimeMs(undefined, FETCH)).toBe(SESSION_MIN_STALE_TIME_MS);
  });

  it('ignora una fecha absoluta inválida en vez de producir NaN', () => {
    const stale = computeSessionStaleTimeMs({
      access_token: 't',
      revalidate_in: 300,
      access_token_expires_in_datetime: 'no es una fecha',
    }, FETCH);
    expect(stale).toBe(300_000 - margenMs);
    expect(Number.isNaN(stale)).toBe(false);
  });
});

describe('createModyoSession', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
  });

  it('comparte una sola llamada /me entre peticiones concurrentes', async () => {
    const stub = makeProfileClient([profileWith('tok-1', { revalidate_in: 300 })]);
    stub.hold();
    const session = createModyoSession({
      realm: 'retail', queryClient, profileClient: stub.client,
    });

    // Cuatro peticiones concurrentes, como un dashboard al montar.
    const pending = Promise.all([
      session.getAccessToken(), session.getAccessToken(),
      session.getAccessToken(), session.getAccessToken(),
    ]);
    stub.release();

    expect(await pending).toEqual(['tok-1', 'tok-1', 'tok-1', 'tok-1']);
    expect(stub.calls).toHaveLength(1);
  });

  it('reutiliza el token cacheado mientras sigue fresco', async () => {
    const stub = makeProfileClient([profileWith('tok-1', { revalidate_in: 300 })]);
    const session = createModyoSession({
      realm: 'retail', queryClient, profileClient: stub.client,
    });

    await session.getAccessToken();
    await session.getAccessToken();
    await session.getAccessToken();

    expect(stub.calls).toHaveLength(1);
  });

  it('vuelve a pedir /me cuando el token expiró', async () => {
    const stub = makeProfileClient([
      // revalidate_in bajo: la frescura cae al piso de 5s.
      profileWith('tok-1', { revalidate_in: 1 }),
      profileWith('tok-2', { revalidate_in: 300 }),
    ]);
    const session = createModyoSession({
      realm: 'retail', queryClient, profileClient: stub.client,
    });

    expect(await session.getAccessToken()).toBe('tok-1');
    expect(stub.calls).toHaveLength(1);

    // Se avanza el reloj más allá del piso de frescura.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + SESSION_MIN_STALE_TIME_MS + 1_000);
    try {
      expect(await session.getAccessToken()).toBe('tok-2');
    } finally {
      vi.useRealTimers();
    }
    expect(stub.calls).toHaveLength(2);
  });

  it('falla con SessionError si /me no trae token delegado', async () => {
    const stub = makeProfileClient([{ username: 'ana' }]);
    const session = createModyoSession({
      realm: 'retail', queryClient, profileClient: stub.client,
    });

    await expect(session.getAccessToken()).rejects.toBeInstanceOf(SessionError);
  });

  describe('invalidateAccessToken', () => {
    it('descarta el token y el siguiente getAccessToken pide uno nuevo', async () => {
      const stub = makeProfileClient([
        profileWith('tok-1', { revalidate_in: 300 }),
        profileWith('tok-2', { revalidate_in: 300 }),
      ]);
      const session = createModyoSession({
        realm: 'retail', queryClient, profileClient: stub.client,
      });

      expect(await session.getAccessToken()).toBe('tok-1');
      session.invalidateAccessToken('tok-1');
      expect(await session.getAccessToken()).toBe('tok-2');
      expect(stub.calls).toHaveLength(2);
    });

    it('no descarta un token que ya fue reemplazado (evita la estampida)', async () => {
      const stub = makeProfileClient([
        profileWith('tok-1', { revalidate_in: 300 }),
        profileWith('tok-2', { revalidate_in: 300 }),
      ]);
      const session = createModyoSession({
        realm: 'retail', queryClient, profileClient: stub.client,
      });

      await session.getAccessToken();
      session.invalidateAccessToken('tok-1');      // primer 401
      expect(await session.getAccessToken()).toBe('tok-2');

      // Segundo 401 concurrente, que traía el token viejo: no debe tirar tok-2.
      session.invalidateAccessToken('tok-1');
      expect(await session.getAccessToken()).toBe('tok-2');
      expect(stub.calls).toHaveLength(2);
    });

    it('sin argumento descarta siempre', async () => {
      const stub = makeProfileClient([
        profileWith('tok-1', { revalidate_in: 300 }),
        profileWith('tok-2', { revalidate_in: 300 }),
      ]);
      const session = createModyoSession({
        realm: 'retail', queryClient, profileClient: stub.client,
      });

      await session.getAccessToken();
      session.invalidateAccessToken();
      expect(await session.getAccessToken()).toBe('tok-2');
    });
  });

  describe('aislamiento entre sesiones', () => {
    // La clave de cache lleva el endpoint. Con una clave fija, dos sesiones que
    // compartan QueryClient -el por defecto incluido- se devolverian el perfil y
    // el token la una a la otra sin llegar a llamar a su propio /me.

    it('dos realms no comparten token aunque compartan QueryClient', async () => {
      const retail = makeProfileClient([profileWith('tok-retail', { revalidate_in: 300 })]);
      const empresas = makeProfileClient([profileWith('tok-empresas', { revalidate_in: 300 })]);

      const sesionRetail = createModyoSession({
        realm: 'retail', queryClient, profileClient: retail.client,
      });
      const sesionEmpresas = createModyoSession({
        realm: 'empresas', queryClient, profileClient: empresas.client,
      });

      expect(await sesionRetail.getAccessToken()).toBe('tok-retail');
      expect(await sesionEmpresas.getAccessToken()).toBe('tok-empresas');

      // Cada una llamó a su propio endpoint.
      expect(retail.calls).toEqual(['/api/customers/realms/retail/me']);
      expect(empresas.calls).toEqual(['/api/customers/realms/empresas/me']);
    });

    it('el mismo realm en otro portal tampoco se mezcla', async () => {
      const local = makeProfileClient([profileWith('tok-local', { revalidate_in: 300 })]);
      const remoto = makeProfileClient([profileWith('tok-remoto', { revalidate_in: 300 })]);

      const a = createModyoSession({
        realm: 'retail', queryClient, profileClient: local.client,
      });
      const b = createModyoSession({
        realm: 'retail', portalBaseUrl: 'https://otro.modyo.cloud', queryClient, profileClient: remoto.client,
      });

      expect(await a.getAccessToken()).toBe('tok-local');
      expect(await b.getAccessToken()).toBe('tok-remoto');
    });

    it('invalidar una sesión no tira el token de la otra', async () => {
      const retail = makeProfileClient([
        profileWith('tok-retail-1', { revalidate_in: 300 }),
        profileWith('tok-retail-2', { revalidate_in: 300 }),
      ]);
      const empresas = makeProfileClient([profileWith('tok-empresas', { revalidate_in: 300 })]);

      const sesionRetail = createModyoSession({
        realm: 'retail', queryClient, profileClient: retail.client,
      });
      const sesionEmpresas = createModyoSession({
        realm: 'empresas', queryClient, profileClient: empresas.client,
      });

      await sesionRetail.getAccessToken();
      await sesionEmpresas.getAccessToken();

      sesionRetail.invalidateAccessToken();

      expect(await sesionRetail.getAccessToken()).toBe('tok-retail-2');
      // La de empresas sigue cacheada: un solo /me en toda su vida.
      expect(await sesionEmpresas.getAccessToken()).toBe('tok-empresas');
      expect(empresas.calls).toHaveLength(1);
    });
  });

  describe('expiración absoluta', () => {
    it('no vuelve a pedir /me a mitad de la vida del token', async () => {
      // La regresión reportada: con el cálculo anclado a Date.now() se contaba
      // dos veces la edad del cache y un token de 300s quedaba stale a los 140s.
      const T0 = new Date('2026-01-01T00:00:00.000Z').getTime();
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      try {
        const stub = makeProfileClient([
          // Solo expiración absoluta, que es el camino afectado.
          profileWith('tok-1', {
            access_token_expires_in_datetime: new Date(T0 + 300_000).toISOString(),
          }),
          profileWith('tok-2', { revalidate_in: 300 }),
        ]);
        const session = createModyoSession({
          realm: 'retail', queryClient, profileClient: stub.client,
        });

        expect(await session.getAccessToken()).toBe('tok-1');

        vi.setSystemTime(T0 + 150_000);   // mitad de la vida
        expect(await session.getAccessToken()).toBe('tok-1');
        expect(stub.calls).toHaveLength(1);

        vi.setSystemTime(T0 + 295_000);   // pasada la ventana (300s - 10s margen)
        expect(await session.getAccessToken()).toBe('tok-2');
        expect(stub.calls).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('no genera tráfico de fondo', () => {
    // Cada /me que re-acuña el token gasta el refresh grant de Keycloak y
    // resetea el reloj de inactividad del sitio. Un refetch automático
    // convertiría este módulo en un keepalive.

    it('crear la sesión no dispara ningún /me', async () => {
      const stub = makeProfileClient([profileWith('tok-1', { revalidate_in: 300 })]);
      createModyoSession({ realm: 'retail', queryClient, profileClient: stub.client });
      await Promise.resolve();

      expect(stub.calls).toHaveLength(0);
    });

    it('las opciones desactivan todo refetch automático', () => {
      // Se afirma sobre la configuración y no sobre un evento de foco a
      // propósito: esos flags solo actúan cuando algo se suscribe con
      // useQuery, y con fetchQuery no hay observadores, así que un test de
      // comportamiento pasaría en vacío. Esto es lo que de verdad protege la
      // invariante el día que un hook se suscriba a la sesión.
      const options = createSessionQueryOptions('/api/customers/realms/r/me', async () => ({}));

      expect(options.refetchOnWindowFocus).toBe(false);
      expect(options.refetchOnReconnect).toBe(false);
      expect(options.refetchOnMount).toBe(false);
      expect(options.refetchInterval).toBe(false);
      expect(options.retry).toBe(false);
    });
  });
});
