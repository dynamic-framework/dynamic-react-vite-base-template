/**
 * Authorization interceptors: attach the Modyo delegated token, and recover from
 * a 401 once.
 *
 * Split in two because axios keeps request and response interceptors in separate
 * chains, and because the 401 half needs the client itself in order to replay
 * the request.
 */
import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

import { withoutTrailingSlash } from '../modyoSession';
import type { ApiInterceptor } from './types';

/**
 * Matches an absolute URL (`scheme://…`) or a *scheme-relative* one (`//host/…`).
 * The scheme is optional in both cases: for the browser and for axios,
 * `//evil.com/x` is already absolute even without `http:` in front.
 */
const ABSOLUTE_OR_SCHEME_RELATIVE_URL = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;

/**
 * Origin used to resolve relative URLs so they can be compared as URLs. Never
 * requested; `.invalid` is reserved by RFC 2606 precisely for this.
 */
const INTERNAL_ORIGIN = 'http://widget.invalid';

/** Removes leading slashes, so `base` + `/path` never yields `base//path`. */
function withoutLeadingSlashes(url: string): string {
  let start = 0;
  while (start < url.length && url[start] === '/') {
    start += 1;
  }
  return url.slice(start);
}

/**
 * The URL a request will actually hit, mirroring axios' own `buildFullPath`:
 * an absolute `url` ignores `baseURL` entirely.
 *
 * It takes `baseURL` as a parameter rather than reading the client's default,
 * because the whole point is that a request can override it.
 */
export function resolveRequestUrl(baseUrl: string | undefined, url: string | undefined): string {
  const target = url ?? '';
  if (!baseUrl || ABSOLUTE_OR_SCHEME_RELATIVE_URL.test(target)) {
    return target;
  }
  return `${withoutTrailingSlash(baseUrl)}/${withoutLeadingSlashes(target)}`;
}

/**
 * `true` only when the request will actually land inside the trusted API base.
 *
 * Checking `config.url` alone is **not enough**: axios accepts a per-request
 * `baseURL`, so `api.get('/data', { baseURL: 'https://third-party.example' })`
 * has a perfectly relative `url` and would pass a path-only guard — sending the
 * delegated token to an arbitrary host, and, on a 401, invalidating the session
 * and replaying the request there. The destination has to be resolved first and
 * compared against the base captured when the interceptor was registered.
 *
 * An allow list, not a deny list. Denying only `/^https?:\/\//i` lets
 * scheme-relative URLs like `//evil.com/x` through: axios does not prepend
 * `baseURL` to those, yet a deny list would consider them "ours".
 *
 * The path comparison is segment-aware, so a trusted base of `/api` does not
 * also trust `/apifoo`.
 */
export function isTrustedDestination(trustedBaseUrl: string, requestUrl: string): boolean {
  if (!requestUrl) {
    return false;
  }

  let target: URL;
  let trusted: URL;
  try {
    target = new URL(requestUrl, INTERNAL_ORIGIN);
    trusted = new URL(trustedBaseUrl || '/', INTERNAL_ORIGIN);
  } catch {
    // An unparseable destination is not a trusted one.
    return false;
  }

  if (target.origin !== trusted.origin) {
    return false;
  }

  const trustedPath = withoutTrailingSlash(trusted.pathname);
  return target.pathname === trustedPath || target.pathname.startsWith(`${trustedPath}/`);
}

/** Resolves a request's destination and tells whether it is the trusted API. */
function targetsTrustedApi(
  trustedBaseUrl: string,
  config: Pick<InternalAxiosRequestConfig, 'baseURL' | 'url' | 'allowAbsoluteUrls'>,
): boolean {
  const requestUrl = config.baseURL && config.allowAbsoluteUrls === false
    ? `${withoutTrailingSlash(config.baseURL)}/${withoutLeadingSlashes(config.url ?? '')}`
    : resolveRequestUrl(config.baseURL, config.url);
  return isTrustedDestination(trustedBaseUrl, requestUrl);
}

/** Marker so a replayed request is never replayed again. */
type RetryableConfig = InternalAxiosRequestConfig & { modyoAuthRetried?: boolean };

/** Reads back the token this request was sent with, to detect a stale one. */
function tokenFromConfig(config: InternalAxiosRequestConfig): string | undefined {
  const header = config.headers?.get?.('Authorization') ?? config.headers?.Authorization;
  const value = typeof header === 'string' ? header : undefined;
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;
}

/**
 * Attaches `Authorization: Bearer <token>` to requests that land inside
 * `trustedBaseUrl`.
 *
 * If no token can be obtained (invalid session, no delegated token) this throws
 * and axios never emits the request. Letting it out without credentials would
 * produce a 401 from the backend that hides the real cause — which is precisely
 * what the implementations this module replaces do when they swallow the error
 * and send the request anyway.
 */
export function createAuthorizationRequestInterceptor(
  session: Pick<ModyoSessionLike, 'getAccessToken'>,
  trustedBaseUrl: string,
) {
  return async function attachAuthorizationHeader(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    if (!targetsTrustedApi(trustedBaseUrl, config)) {
      return config;
    }

    const accessToken = await session.getAccessToken();
    config.headers.set('Authorization', `Bearer ${accessToken}`);
    return config;
  };
}

/**
 * On a 401 from the trusted API, drops the cached token and replays the request
 * **once**.
 *
 * Once, not "until it works": if the fresh token is rejected too, the problem is
 * not staleness and a loop would just multiply the damage. The replay goes back
 * through the request chain, so it picks up the new token by itself.
 *
 * It applies the same destination check as the request half, on purpose: a 401
 * from a third-party host must not invalidate the Modyo session nor get replayed.
 */
export function createUnauthorizedRetryInterceptor(
  session: Pick<ModyoSessionLike, 'invalidateAccessToken'>,
  client: AxiosInstance,
  trustedBaseUrl: string,
) {
  return async function retryOnceOnUnauthorized(error: AxiosError) {
    const config = error.config as RetryableConfig | undefined;

    const retryable = config
      && error.response?.status === 401
      && targetsTrustedApi(trustedBaseUrl, config)
      && !config.modyoAuthRetried;

    if (!retryable) {
      return Promise.reject(error);
    }

    config.modyoAuthRetried = true;
    session.invalidateAccessToken(tokenFromConfig(config));
    return client.request(config);
  };
}

/** Structural subset of the session these interceptors need. */
type ModyoSessionLike = {
  getAccessToken: () => Promise<string>;
  invalidateAccessToken: (staleToken?: string) => void;
};

/**
 * The pluggable pair, ready for `applyInterceptors`.
 *
 * The trusted base is captured **here**, at registration, and not read from
 * `client.defaults` per request: that is exactly the value a request can
 * override, and reading it later would make the guard trust whatever the caller
 * asked for.
 */
export function withModyoAuthorization(session: ModyoSessionLike): ApiInterceptor {
  return (client) => {
    const trustedBaseUrl = client.defaults.baseURL ?? '';

    client.interceptors.request.use(
      createAuthorizationRequestInterceptor(session, trustedBaseUrl),
    );
    client.interceptors.response.use(
      (response) => response,
      createUnauthorizedRetryInterceptor(session, client, trustedBaseUrl),
    );
  };
}
