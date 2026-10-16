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

  it('usa revalidate_in, que ya es la vida restante', () => {
    expect(computeSessionStaleTimeMs({ access_token: 't', revalidate_in: 300 }))
      .toBe(300_000 - margenMs);
  });

  it('se queda con el menor de los límites disponibles', () => {
    const stale = computeSessionStaleTimeMs({
      access_token: 't',
      revalidate_in: 300,
      access_token_expires_in: 120,
    });
    expect(stale).toBe(120_000 - margenMs);
  });

  it('acota con la expiración absoluta cuando es más cercana', () => {
    const nowMs = 1_000_000;
    const stale = computeSessionStaleTimeMs({
      access_token: 't',
      revalidate_in: 300,
      access_token_expires_in_datetime: new Date(nowMs + 60_000).toISOString(),
    }, nowMs);
    expect(stale).toBe(60_000 - margenMs);
  });

  it('aplica el TTL por defecto si /me no manda ningún campo de tiempo', () => {
    expect(computeSessionStaleTimeMs({ access_token: 't' }))
      .toBe((FALLBACK_TOKEN_TTL_SECONDS - SESSION_SAFETY_MARGIN_SECONDS) * 1000);
  });

  it('nunca baja del piso, para no entrar en bucle de refetch', () => {
    expect(computeSessionStaleTimeMs({ access_token: 't', revalidate_in: 1 }))
      .toBe(SESSION_MIN_STALE_TIME_MS);
    expect(computeSessionStaleTimeMs({ access_token: 't', revalidate_in: -100 }))
      .toBe(SESSION_MIN_STALE_TIME_MS);
  });

  it('sin token devuelve el piso', () => {
    expect(computeSessionStaleTimeMs(undefined)).toBe(SESSION_MIN_STALE_TIME_MS);
  });

  it('ignora una fecha absoluta inválida en vez de producir NaN', () => {
    const stale = computeSessionStaleTimeMs({
      access_token: 't',
      revalidate_in: 300,
      access_token_expires_in_datetime: 'no es una fecha',
    });
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
      const options = createSessionQueryOptions(async () => ({}));

      expect(options.refetchOnWindowFocus).toBe(false);
      expect(options.refetchOnReconnect).toBe(false);
      expect(options.refetchOnMount).toBe(false);
      expect(options.refetchInterval).toBe(false);
      expect(options.retry).toBe(false);
    });
  });
});
