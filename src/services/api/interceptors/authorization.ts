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

import type { ModyoSession } from '../modyoSession';
import type { ApiInterceptor } from './types';

/**
 * Matches an absolute URL (`scheme://…`) or a *scheme-relative* one (`//host/…`).
 * The scheme is optional in both cases: for the browser and for axios,
 * `//evil.com/x` is already absolute even without `http:` in front.
 */
const ABSOLUTE_OR_SCHEME_RELATIVE_URL = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;

/**
 * `true` only for requests to the widget's own API, meaning a URL unambiguously
 * relative to `baseURL`.
 *
 * An allow list, not a deny list. Denying only `/^https?:\/\//i` lets
 * scheme-relative URLs like `//evil.com/x` through: axios does not prepend
 * `baseURL` to those, yet a deny list would consider them "ours", so the
 * interceptor would attach the Bearer and the token would travel to an
 * arbitrary host.
 *
 * It also keeps the token off third-party calls made through the same instance
 * (Modyo's public Content API, for one), which expect no Bearer and would
 * otherwise each trigger a session fetch.
 */
export function isOwnApiRequest(url?: string): boolean {
  return !!url && !ABSOLUTE_OR_SCHEME_RELATIVE_URL.test(url);
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
 * Attaches `Authorization: Bearer <token>` to the widget's own API requests.
 *
 * If no token can be obtained (invalid session, no delegated token) this throws
 * and axios never emits the request. Letting it out without credentials would
 * produce a 401 from the backend that hides the real cause — which is precisely
 * what the implementations this module replaces do when they swallow the error
 * and send the request anyway.
 */
export function createAuthorizationRequestInterceptor(session: ModyoSession) {
  return async function attachAuthorizationHeader(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    if (!isOwnApiRequest(config.url)) {
      return config;
    }

    const accessToken = await session.getAccessToken();
    config.headers.set('Authorization', `Bearer ${accessToken}`);
    return config;
  };
}

/**
 * On a 401 from the backend, drops the cached token and replays the request
 * **once**.
 *
 * Once, not "until it works": if the fresh token is rejected too, the problem is
 * not staleness and a loop would just multiply the damage. The replay goes back
 * through the request chain, so it picks up the new token by itself.
 */
export function createUnauthorizedRetryInterceptor(
  session: ModyoSession,
  client: AxiosInstance,
) {
  return async function retryOnceOnUnauthorized(error: AxiosError) {
    const config = error.config as RetryableConfig | undefined;

    const retryable = config
      && error.response?.status === 401
      && isOwnApiRequest(config.url)
      && !config.modyoAuthRetried;

    if (!retryable) {
      return Promise.reject(error);
    }

    config.modyoAuthRetried = true;
    session.invalidateAccessToken(tokenFromConfig(config));
    return client.request(config);
  };
}

/** The pluggable pair, ready for `applyInterceptors`. */
export function withModyoAuthorization(session: ModyoSession): ApiInterceptor {
  return (client) => {
    client.interceptors.request.use(createAuthorizationRequestInterceptor(session));
    client.interceptors.response.use(
      (response) => response,
      createUnauthorizedRetryInterceptor(session, client),
    );
  };
}
