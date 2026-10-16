/**
 * Modyo session: the delegated token a widget needs to call the client's API.
 *
 * `GET /api/customers/realms/{realm}/me` returns the signed-in customer's
 * profile, and inside it the `delegated_token` whose `access_token` the backend
 * expects as `Authorization: Bearer`. Asking for it once per outgoing request —
 * the pattern this module exists to replace — means a dashboard pays four or
 * five serial `/me` calls on mount for four useful ones.
 *
 * ## The cache is TanStack Query, not a Map of our own
 *
 * `queryClient.fetchQuery` already returns the cached value while it is fresh
 * and, when a `/me` is in flight, hangs off that one instead of firing another.
 * That is exactly "cache + a single shared in-flight call", and it comes with an
 * observable cache, which a hand-rolled `Map` + promise would not.
 *
 * ## Freshness, and why the safety margin is small
 *
 * Modyo **only re-mints the token once it has already expired**: while the token
 * is alive, `/me` returns the same one with less life left. So refreshing early
 * buys nothing, and a generous margin is actively harmful — it makes every
 * request inside the margin pay a `/me` that changes nothing. Hence ten seconds
 * of margin and an absolute floor, instead of the minute or two that would look
 * prudent.
 *
 * ## No background traffic, on purpose
 *
 * Every `/me` that re-mints the token spends the Keycloak refresh grant, and
 * that resets the SSO Session Idle clock. A module that polled `/me` on a timer,
 * on window focus or on reconnect would therefore be a **keepalive**: it would
 * silently defeat the site's inactivity logout and keep a session alive on an
 * unattended screen. This module only ever fetches when an outgoing request
 * actually needs a token and the cached one is stale — the refetch flags below
 * are off explicitly rather than inherited from the QueryClient defaults.
 */
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import axios, { isAxiosError, type AxiosInstance } from 'axios';

import { queryClient as defaultQueryClient } from '../../providers/queryClient';
import type { DelegatedToken, ModyoProfile } from '../../types';

/**
 * Seconds subtracted from the token's remaining life before treating it as
 * freshness. Small on purpose — see the module docblock.
 */
export const SESSION_SAFETY_MARGIN_SECONDS = 10;

/** Absolute freshness floor, so a tiny remaining life cannot cause a refetch loop. */
export const SESSION_MIN_STALE_TIME_MS = 5_000;

/**
 * Freshness used when `/me` reports no time fields at all. Five minutes matches
 * the delegated token lifetime Modyo issues today, minus the safety margin.
 */
export const FALLBACK_TOKEN_TTL_SECONDS = 300;

/** Thrown when there is no usable session. Retrying does not fix it. */
export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

/** Removes trailing slashes so `https://host//api/...` is never built. */
export function withoutTrailingSlash(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') {
    end -= 1;
  }
  return url.slice(0, end);
}

/**
 * Builds the profile endpoint.
 *
 * Never use `/api/profile`: that path is a backwards-compatibility alias with
 * `realm_uid: 'default'` hardcoded in Modyo, so a widget living in another realm
 * would silently read the wrong one.
 *
 * `portalBaseUrl` is empty by default, which yields a relative URL — correct
 * when the portal itself serves the widget, which is the normal case.
 */
export function buildProfileUrl(realm: string, portalBaseUrl = ''): string {
  if (!realm) {
    throw new SessionError('A customers realm is required; never assume "default".');
  }
  return `${withoutTrailingSlash(portalBaseUrl)}/api/customers/realms/${realm}/me`;
}

/**
 * How long the cached profile counts as fresh, bounded by **both** time facts
 * the token carries.
 *
 * `revalidate_in` is already the remaining life, so under normal conditions it
 * wins. The absolute expiry comes in as a second bound: it changes nothing while
 * the two agree, and protects the computation if they ever drift apart.
 */
export function computeSessionStaleTimeMs(
  token: DelegatedToken | undefined,
  nowMs: number = Date.now(),
): number {
  if (token === undefined) {
    return SESSION_MIN_STALE_TIME_MS;
  }

  const marginMs = SESSION_SAFETY_MARGIN_SECONDS * 1000;
  const candidatesMs: number[] = [];

  if (typeof token.revalidate_in === 'number') {
    candidatesMs.push(token.revalidate_in * 1000 - marginMs);
  }
  if (typeof token.access_token_expires_in === 'number') {
    candidatesMs.push(token.access_token_expires_in * 1000 - marginMs);
  }
  const expiresAtMs = Date.parse(token.access_token_expires_in_datetime ?? '');
  if (!Number.isNaN(expiresAtMs)) {
    candidatesMs.push(expiresAtMs - nowMs - marginMs);
  }

  if (candidatesMs.length === 0) {
    // No time fields: fall back to the lifetime Modyo issues today.
    return (FALLBACK_TOKEN_TTL_SECONDS - SESSION_SAFETY_MARGIN_SECONDS) * 1000;
  }

  return Math.max(Math.min(...candidatesMs), SESSION_MIN_STALE_TIME_MS);
}

export const sessionQueryKey = ['modyo', 'session'] as const;

export type FetchModyoProfile = (signal?: AbortSignal) => Promise<ModyoProfile>;

/**
 * HTTP client for `/me`, deliberately separate from the API client.
 *
 * The API client attaches `Authorization: Bearer <token>` — the very token this
 * module is responsible for fetching. Sharing it would be circular, and its
 * interceptor would try to attach a Bearer to a request that authenticates by
 * cookie.
 */
export function createProfileClient(): AxiosInstance {
  return axios.create({ withCredentials: true });
}

/** Builds the `/me` fetcher. A 401 here means the site session itself is gone. */
export function createFetchModyoProfile(
  profileUrl: string,
  client: AxiosInstance = createProfileClient(),
): FetchModyoProfile {
  return async function fetchModyoProfile(signal?: AbortSignal): Promise<ModyoProfile> {
    try {
      const response = await client.get<ModyoProfile>(profileUrl, { signal });
      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        throw new SessionError('The Modyo session is invalid or expired.');
      }
      throw error;
    }
  };
}

export function createSessionQueryOptions(fetchProfile: FetchModyoProfile) {
  return queryOptions({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => fetchProfile(signal),
    // A session failure (401, no cookie) is not fixed by retrying.
    retry: false,
    staleTime: (query) => computeSessionStaleTimeMs(query.state.data?.delegated_token),
    // Explicit, not inherited: any of these would turn the module into a
    // keepalive against the site's inactivity logout. See the module docblock.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    refetchInterval: false,
  });
}

export type ModyoSessionConfig = {
  /** Customers realm the widget lives in. Never assume `default`. */
  realm: string;
  /** Portal origin. Empty (the default) yields a relative URL. */
  portalBaseUrl?: string;
  /** The widget's own QueryClient, so the profile is cached and deduped once. */
  queryClient?: QueryClient;
  /** Seam for tests: the client used for the cookie-authenticated `/me` call. */
  profileClient?: AxiosInstance;
};

export type ModyoSession = {
  profileUrl: string;
  /**
   * The query options behind the profile, so a component can subscribe to the
   * same cached `/me` with `useQuery` instead of fetching it again.
   *
   * Subscribing makes the query an *active observer*, which is why every
   * refetch flag is turned off explicitly in {@link createSessionQueryOptions}:
   * an observer with those on would poll `/me` and keep the session alive.
   * A first mount with nothing cached does fetch — that is user-driven, not
   * background traffic.
   */
  queryOptions: ReturnType<typeof createSessionQueryOptions>;
  /** Current profile, from cache while fresh, sharing any in-flight call. */
  getProfile: () => Promise<ModyoProfile>;
  /** Bearer for the API. Throws {@link SessionError} when there is none. */
  getAccessToken: () => Promise<string>;
  /**
   * Drops the cached profile so the next {@link getAccessToken} refetches.
   *
   * Pass the token that just failed: the cache is only dropped when it still
   * holds that same token. Without this guard, N concurrent requests failing
   * with 401 would each invalidate in turn and discard the fresh token the
   * previous one just fetched, turning one retry into a stampede of `/me`.
   */
  invalidateAccessToken: (staleToken?: string) => void;
};

export function createModyoSession({
  realm,
  portalBaseUrl = '',
  queryClient = defaultQueryClient,
  profileClient,
}: ModyoSessionConfig): ModyoSession {
  const profileUrl = buildProfileUrl(realm, portalBaseUrl);
  const fetchProfile = createFetchModyoProfile(profileUrl, profileClient);
  const options = createSessionQueryOptions(fetchProfile);

  const getProfile = () => queryClient.fetchQuery(options);

  const getAccessToken = async (): Promise<string> => {
    const profile = await getProfile();
    const accessToken = profile.delegated_token?.access_token;

    if (!accessToken) {
      throw new SessionError('The Modyo session carries no usable delegated token.');
    }

    return accessToken;
  };

  const invalidateAccessToken = (staleToken?: string): void => {
    if (staleToken !== undefined) {
      const cached = queryClient.getQueryData<ModyoProfile>(sessionQueryKey);
      if (cached?.delegated_token?.access_token !== staleToken) {
        // Someone already replaced it; dropping it now would throw away a good
        // token and trigger another /me.
        return;
      }
    }
    // `removeQueries`, not `invalidateQueries`: invalidating marks the query
    // stale and makes active observers refetch in the background, which is the
    // traffic this module must not generate.
    queryClient.removeQueries({ queryKey: sessionQueryKey, exact: true });
  };

  return {
    profileUrl, queryOptions: options, getProfile, getAccessToken, invalidateAccessToken,
  };
}
