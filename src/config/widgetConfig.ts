import './liquidConfig';

import type { DContextProvider } from '@dynamic-framework/ui-react';
import type { ComponentProps } from 'react';

import liquidParser from '../utils/liquidParser';

export const DEFAULT_LANGUAGE = 'es';

export function resolveSiteLanguage(raw: string): string {
  const language = raw.trim();
  if (!language || (language.includes('{{') && language.includes('}}'))) {
    return DEFAULT_LANGUAGE;
  }
  return language;
}

export const SITE_LANG = resolveSiteLanguage(liquidParser.parse('{{site.language}}'));
export const SITE_NAME = liquidParser.parse('{{site.name}}');

export const VARS_CURRENCY = {
  symbol: liquidParser.parse('{{vars.currency-symbol}}'),
  precision: Number(liquidParser.parse('{{vars.currency-precision}}')),
  separator: liquidParser.parse('{{vars.currency-separator}}'),
  decimal: liquidParser.parse('{{vars.currency-decimal}}'),
};

export const CONTEXT_CONFIG = {
  language: SITE_LANG,
  currency: VARS_CURRENCY,
} satisfies Partial<ComponentProps<typeof DContextProvider>>;

// API Configuration
export const API_BASE_URL = liquidParser.parse('{{vars.api-base-url}}');
export const USE_MOCKS = liquidParser.parse('{{vars.use-mocks}}') === 'true';

export const widgetConfig = {
  apiBaseUrl: API_BASE_URL,
  useMocks: USE_MOCKS,
  siteLang: SITE_LANG,
  siteName: SITE_NAME,
};
