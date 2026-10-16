import axios, { AxiosHeaders, type AxiosAdapter, type AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyInterceptors,
  isOwnApiRequest,
  withAcceptLanguage,
  withModyoAuthorization,
} from '../../../src/services/api/interceptors';
import {
  createSessionQueryOptions,
  type ModyoSession,
} from '../../../src/services/api/modyoSession';

type RecordedRequest = { url?: string; authorization?: string; acceptLanguage?: string };

/**
 * Axios instance whose adapter is a stub: records what each request carried and
 * answers with the status the test queues up. Lets the whole interceptor chain
 * run for real, including the replay.
 */
function makeClient(statuses: number[]) {
  const requests: RecordedRequest[] = [];
  let call = 0;

  const adapter: AxiosAdapter = async (config) => {
    const headers = AxiosHeaders.from(config.headers);
    requests.push({
      url: config.url,
      authorization: headers.get('Authorization') as string | undefined,
      acceptLanguage: headers.get('Accept-Language') as string | undefined,
    });
    const status = statuses[Math.min(call, statuses.length - 1)];
    call += 1;
    const response = {
      data: { ok: status < 400 }, status, statusText: '', headers: {}, config,
    };
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true, config, response, toJSON: () => ({}),
      });
    }
    return response;
  };

  const client = axios.create({ baseURL: '/api', adapter });
  return { client, requests };
}

/** Session stub handing out tok-1, then tok-2 after an invalidation. */
function makeSession() {
  let serial = 1;
  let current = `tok-${serial}`;
  const invalidations: Array<string | undefined> = [];

  const session: ModyoSession = {
    profileUrl: '/api/customers/realms/retail/me',
    queryOptions: createSessionQueryOptions(async () => ({})),
    getProfile: vi.fn(async () => ({ delegated_token: { access_token: current } })),
    getAccessToken: vi.fn(async () => current),
    invalidateAccessToken: vi.fn((staleToken?: string) => {
      invalidations.push(staleToken);
      if (staleToken === undefined || staleToken === current) {
        serial += 1;
        current = `tok-${serial}`;
      }
    }),
  };
  return { session, invalidations, getCurrent: () => current };
}

function wire(statuses: number[]): { client: AxiosInstance } & ReturnType<typeof makeSession>
  & { requests: RecordedRequest[] } {
  const { client, requests } = makeClient(statuses);
  const session = makeSession();
  applyInterceptors(client, [withAcceptLanguage('es'), withModyoAuthorization(session.session)]);
  return { client, requests, ...session };
}

describe('isOwnApiRequest', () => {
  it('acepta solo rutas relativas al baseURL', () => {
    expect(isOwnApiRequest('/entities')).toBe(true);
    expect(isOwnApiRequest('entities')).toBe(true);
  });

  it('rechaza URLs absolutas', () => {
    expect(isOwnApiRequest('https://evil.com/x')).toBe(false);
    expect(isOwnApiRequest('http://evil.com/x')).toBe(false);
  });

  it('rechaza URLs relativas al esquema, que axios trata como absolutas', () => {
    // El bug que una deny list de /^https?:\/\// deja pasar: el Bearer viajaria
    // a un host arbitrario.
    expect(isOwnApiRequest('//evil.com/x')).toBe(false);
    expect(isOwnApiRequest('ftp://host/x')).toBe(false);
  });

  it('rechaza una url ausente', () => {
    expect(isOwnApiRequest(undefined)).toBe(false);
    expect(isOwnApiRequest('')).toBe(false);
  });
});

describe('withModyoAuthorization', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('adjunta el Bearer a las peticiones propias', async () => {
    const { client, requests } = wire([200]);

    await client.get('/entities');

    expect(requests[0].authorization).toBe('Bearer tok-1');
  });

  it('no manda el token a hosts externos', async () => {
    const { client, requests, session } = wire([200]);

    await client.get('https://api.tercero.com/data');

    expect(requests[0].authorization).toBeUndefined();
    // Y no gasta un /me para una peticion que no lo necesita.
    expect(session.getAccessToken).not.toHaveBeenCalled();
  });

  it('cancela la peticion si no hay token, en vez de mandarla sin credenciales', async () => {
    const { client, requests } = wire([200]);
    const session = makeSession();
    const fallando = axios.create({ baseURL: '/api', adapter: client.defaults.adapter });
    (session.session.getAccessToken as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('sin sesión'));
    applyInterceptors(fallando, [withModyoAuthorization(session.session)]);

    await expect(fallando.get('/entities')).rejects.toThrow('sin sesión');
    // Un 401 del backend habria escondido la causa real.
    expect(requests).toHaveLength(0);
  });

  describe('401', () => {
    it('invalida el token y reintenta la peticion una vez', async () => {
      const { client, requests, invalidations } = wire([401, 200]);

      const response = await client.get('/entities');

      expect(response.status).toBe(200);
      expect(requests).toHaveLength(2);
      expect(requests[0].authorization).toBe('Bearer tok-1');
      // El replay vuelve a pasar por la cadena y recoge el token nuevo.
      expect(requests[1].authorization).toBe('Bearer tok-2');
      expect(invalidations).toEqual(['tok-1']);
    });

    it('reintenta una sola vez: un segundo 401 se propaga', async () => {
      const { client, requests } = wire([401, 401]);

      await expect(client.get('/entities')).rejects.toMatchObject({
        response: { status: 401 },
      });
      // Dos intentos, no un bucle.
      expect(requests).toHaveLength(2);
    });

    it('no reintenta otros errores', async () => {
      const { client, requests, session } = wire([500, 200]);

      await expect(client.get('/entities')).rejects.toMatchObject({
        response: { status: 500 },
      });
      expect(requests).toHaveLength(1);
      expect(session.invalidateAccessToken).not.toHaveBeenCalled();
    });

    it('no reintenta un 401 de un host externo', async () => {
      const { client, requests, session } = wire([401, 200]);

      await expect(client.get('https://api.tercero.com/data')).rejects.toMatchObject({
        response: { status: 401 },
      });
      expect(requests).toHaveLength(1);
      expect(session.invalidateAccessToken).not.toHaveBeenCalled();
    });

    it('informa el token usado, para que la sesión no descarte uno ya renovado', async () => {
      const { client, invalidations } = wire([401, 200]);

      await client.get('/entities');

      // Sin esto, N peticiones fallando a la vez tirarian cada una el token que
      // la anterior acababa de renovar.
      expect(invalidations).toEqual(['tok-1']);
    });
  });
});

describe('withAcceptLanguage', () => {
  it('manda el idioma del sitio', async () => {
    const { client, requests } = wire([200]);

    await client.get('/entities');

    expect(requests[0].acceptLanguage).toBe('es');
  });

  it('también en las peticiones externas, que no llevan token', async () => {
    const { client, requests } = wire([200]);

    await client.get('https://api.tercero.com/data');

    expect(requests[0].acceptLanguage).toBe('es');
    expect(requests[0].authorization).toBeUndefined();
  });
});
