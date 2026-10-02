import { configureI18n } from '@dynamic-framework/ui-react';

import en from '../locales/en.json';
import es from '../locales/es.json';

import { DEFAULT_LANGUAGE, SITE_LANG } from './widgetConfig';

const resources = {
  es: { translation: es },
  en: { translation: en },
};

configureI18n(resources, { lng: SITE_LANG, fallbackLng: DEFAULT_LANGUAGE });

export const changeLanguage = (lang: keyof typeof resources) => (
  configureI18n(resources, { lng: lang, fallbackLng: DEFAULT_LANGUAGE })
);