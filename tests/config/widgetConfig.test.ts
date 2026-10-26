import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildContextConfig,
  DEFAULT_LANGUAGE,
  findMissingVariables,
  getRequiredVariables,
  isUnresolved,
  resolveCurrency,
  resolveSiteLanguage,
  type RawCurrency,
} from '@/config/widgetConfig';

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

describe('isUnresolved', () => {
  it.each(['', '   ', '{{vars.api-base-url}}', ' {{ vars.api-base-url }} '])(
    'considera sin resolver %j',
    (value) => {
      expect(isUnresolved(value)).toBe(true);
    },
  );

  it('acepta un valor resuelto', () => {
    expect(isUnresolved('https://api.example.com')).toBe(false);
  });
});

describe('findMissingVariables', () => {
  const resolved = { name: 'vars.api-base-url', value: 'https://api.example.com' };

  it('con todas las variables resueltas no falta ninguna', () => {
    expect(findMissingVariables([resolved], false)).toEqual([]);
  });

  it('devuelve las que llegan vacías', () => {
    const empty = { name: 'vars.other-var', value: '' };
    expect(findMissingVariables([resolved, empty], false)).toEqual(['vars.other-var']);
  });

  it('devuelve las que llegan con el tag Liquid sin resolver', () => {
    const literal = { name: 'vars.other-var', value: '{{vars.other-var}}' };
    expect(findMissingVariables([resolved, literal], false)).toEqual(['vars.other-var']);
  });

  it('con mocks activos no exige ninguna', () => {
    const empty = { name: 'vars.api-base-url', value: '' };
    expect(findMissingVariables([empty], true)).toEqual([]);
  });
});

describe('registro de obligatorias', () => {
  it('el núcleo exige vars.api-base-url', () => {
    expect(getRequiredVariables().map(({ name }) => name)).toContain('vars.api-base-url');
  });

  it('cada requireVariable lleva el tag Liquid de su nombre', () => {
    const source = readFileSync(resolve(__dirname, '../../src/config/widgetConfig.ts'), 'utf-8');
    const calls = [...source.matchAll(/requireVariable\(\s*'([^']*)',\s*([^\n]*)/g)];

    expect(calls.length).toBeGreaterThan(0);
    calls.forEach(([, name, rest]) => {
      expect(name).not.toMatch(/[{}]/);
      expect(rest).toContain(`liquidParser.parse('{{${name}}}')`);
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('getMissingVariables', () => {
  async function loadConfig(dev: boolean) {
    vi.resetModules();
    vi.stubEnv('DEV', dev);
    return import('@/config/widgetConfig');
  }

  it('en desarrollo, con use-mocks de liquid.json, no falta ninguna', async () => {
    const config = await loadConfig(true);
    expect(config.USE_MOCKS).toBe(true);
    expect(config.getMissingVariables()).toEqual([]);
  });

  it('sin Liquid resuelto ni mocks, faltan todas las obligatorias', async () => {
    const config = await loadConfig(false);
    const required = config.getRequiredVariables().map(({ name }) => name);

    expect(config.USE_MOCKS).toBe(false);
    expect(required).toContain('vars.api-base-url');
    expect(config.getMissingVariables()).toEqual(required);
  });
});

describe('moneda', () => {
  const raw: RawCurrency = {
    symbol: '$',
    precision: '2',
    separator: '.',
    decimal: ',',
  };

  it('con todas las variables resueltas devuelve el formato del sitio', () => {
    expect(resolveCurrency(raw)).toEqual({
      symbol: '$',
      precision: 2,
      separator: '.',
      decimal: ',',
    });
  });

  it.each(Object.keys(raw) as (keyof RawCurrency)[])(
    'sin resolver %s devuelve undefined',
    (key) => {
      expect(resolveCurrency({ ...raw, [key]: `{{vars.currency-${key}}}` })).toBeUndefined();
    },
  );

  it.each([' ', '\u00A0', '\u202F'])('conserva el separador de miles %j', (separator) => {
    expect(resolveCurrency({ ...raw, symbol: '€', separator })).toEqual({
      symbol: '€',
      precision: 2,
      separator,
      decimal: ',',
    });
  });

  it('sin separador de miles devuelve undefined', () => {
    expect(resolveCurrency({ ...raw, separator: '' })).toBeUndefined();
  });

  it.each(['abc', '-1', '1.5'])('con precisión %j devuelve undefined', (precision) => {
    expect(resolveCurrency({ ...raw, precision })).toBeUndefined();
  });

  it('sin moneda, el contexto no incluye la clave currency', () => {
    const config = buildContextConfig('es', undefined);
    expect(config).toEqual({ language: 'es' });
    expect(config).not.toHaveProperty('currency');
  });

  it('sin Liquid resuelto, CONTEXT_CONFIG no incluye currency', async () => {
    vi.resetModules();
    vi.stubEnv('DEV', false);
    const config = await import('@/config/widgetConfig');

    expect(config.VARS_CURRENCY).toBeUndefined();
    expect(config.CONTEXT_CONFIG).toEqual({ language: DEFAULT_LANGUAGE });
  });
});
