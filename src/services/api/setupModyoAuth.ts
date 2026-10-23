/**
 * One-call activation of the Modyo delegated-token flow on the shared client.
 *
 * Opt-in: nothing imports this module, so the template keeps working against
 * mocks out of the box. To turn it on, add two lines to your entry point (or to
 * `client.ts`, right after the instance is created):
 *
 * ```ts
 * import { enableModyoAuth } from './services/api/setupModyoAuth';
 *
 * enableModyoAuth();
 * ```
 *
 * The realm comes from the `customers-realm` Liquid variable, so the same build
 * works on every site without recompiling. Call it once, at startup: calling it
 * twice registers the interceptors twice and every request would attach the
 * header — and pay the 401 retry — two times over.
 */
import { CUSTOMERS_REALM } from '../../config/widgetConfig';
import { api } from './client';
import { applyInterceptors, withAcceptLanguage, withModyoAuthorization } from './interceptors';
import { createModyoSession, type ModyoSession, type ModyoSessionConfig } from './modyoSession';

export type EnableModyoAuthConfig = Partial<ModyoSessionConfig>;

/**
 * Wires the session and its interceptors onto {@link api}. Returns the session
 * so the widget can also read the profile (name, last login) from the same
 * cached `/me`, instead of fetching it again.
 */
export function enableModyoAuth(config: EnableModyoAuthConfig = {}): ModyoSession {
  const session = createModyoSession({ realm: CUSTOMERS_REALM, ...config });

  applyInterceptors(api, [
    withAcceptLanguage(),
    withModyoAuthorization(session),
  ]);

  return session;
}
