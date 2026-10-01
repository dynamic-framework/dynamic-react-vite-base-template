import { describe, expect, it } from 'vitest';

import { changeLanguage } from '../../src/config/i18nConfig';
import en from '../../src/locales/en.json';
import es from '../../src/locales/es.json';

describe('i18nConfig', () => {
  it('usa las traducciones de es cuando el idioma no tiene recursos', async () => {
    const t = await changeLanguage('fr' as Parameters<typeof changeLanguage>[0]);

    expect(t('title')).toBe(es.title);
    expect(t('title')).not.toBe(en.title);
  });
});
