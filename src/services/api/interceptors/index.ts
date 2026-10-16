import type { AxiosInstance } from 'axios';

import type { ApiInterceptor } from './types';

export type { ApiInterceptor } from './types';
export { withAcceptLanguage, createAcceptLanguageInterceptor } from './acceptLanguage';
export {
  createAuthorizationRequestInterceptor,
  createUnauthorizedRetryInterceptor,
  isOwnApiRequest,
  withModyoAuthorization,
} from './authorization';

/** Registers interceptors onto the base client, in order. */
export function applyInterceptors(
  client: AxiosInstance,
  interceptors: ApiInterceptor[],
): AxiosInstance {
  interceptors.forEach((register) => { register(client); });
  return client;
}
