import { describe, expect, it } from 'vitest';

import { DEFAULT_LANGUAGE, resolveSiteLanguage } from '../../src/config/widgetConfig';

describe('resolveSiteLanguage', () => {
  it('el idioma por defecto es es', () => {
    expect(DEFAULT_LANGUAGE).toBe('es');
  });

  it('devuelve es cuando site.language llega vacío', () => {
    expect(resolveSiteLanguage('')).toBe('es');
  });

  it('devuelve es cuando {{site.language}} llega sin resolver', () => {
    expect(resolveSiteLanguage('{{site.language}}')).toBe('es');
  });

  it('respeta el idioma del sitio cuando viene resuelto', () => {
    expect(resolveSiteLanguage('en')).toBe('en');
  });
});
