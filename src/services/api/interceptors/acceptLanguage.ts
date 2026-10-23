/**
 * Sends the site's language on every request, so the backend can localize its
 * responses and its errors.
 *
 * Second interceptor mostly to show the seam is real: the language comes from
 * `{{site.language}}` through `widgetConfig`, nothing here knows about Liquid.
 */
import type { InternalAxiosRequestConfig } from 'axios';

import { SITE_LANG } from '../../../config/widgetConfig';
import type { ApiInterceptor } from './types';

export function createAcceptLanguageInterceptor(language: string) {
  return function attachAcceptLanguage(
    config: InternalAxiosRequestConfig,
  ): InternalAxiosRequestConfig {
    config.headers.set('Accept-Language', language);
    return config;
  };
}

export function withAcceptLanguage(language: string = SITE_LANG): ApiInterceptor {
  return (client) => {
    client.interceptors.request.use(createAcceptLanguageInterceptor(language));
  };
}
