import path from 'node:path';

import { describe, expect, it } from 'vitest';

import stripLiquidDevConfig, {
  EMPTY_JSON,
  isLiquidDevConfig,
  LIQUID_DEV_CONFIG,
} from '../../.vite/plugins/stripLiquidDevConfig';

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.resolve(ROOT, LIQUID_DEV_CONFIG);

type AnyHook = (...args: unknown[]) => unknown;
const hook = (plugin: unknown, name: string) => (plugin as Record<string, AnyHook>)[name];

/** Plugin con la raíz ya resuelta, como lo deja Vite antes de construir. */
function makePlugin() {
  const plugin = stripLiquidDevConfig();
  hook(plugin, 'configResolved')({ root: ROOT });
  return plugin;
}

const load = (plugin: unknown, id: string) => hook(plugin, 'load')(id);

describe('stripLiquidDevConfig', () => {
  it('solo se aplica en build y antes de vite:json', () => {
    const plugin = stripLiquidDevConfig();
    expect(plugin.name).toBe('strip-liquid-dev-config');
    expect(plugin.apply).toBe('build');
    expect(plugin.enforce).toBe('pre');
  });

  it('sustituye liquid.json por un objeto vacío', () => {
    expect(load(makePlugin(), CONFIG_PATH)).toBe(EMPTY_JSON);
  });

  it('ignora el query que Vite añade al id', () => {
    expect(load(makePlugin(), `${CONFIG_PATH}?import`)).toBe(EMPTY_JSON);
  });

  it('no toca ningún otro módulo', () => {
    const plugin = makePlugin();
    const otros = [
      path.resolve(ROOT, 'package.json'),
      path.resolve(ROOT, 'src/config/widgetConfig.ts'),
      path.resolve(ROOT, 'src/config/liquid.json.ts'),
      path.resolve(ROOT, 'src/liquid.json'),
    ];
    for (const id of otros) {
      expect(load(plugin, id), id).toBeNull();
    }
  });

  it('resuelve la ruta contra la raíz que informa Vite', () => {
    const plugin = stripLiquidDevConfig();
    hook(plugin, 'configResolved')({ root: '/otra/raiz' });
    expect(load(plugin, CONFIG_PATH)).toBeNull();
    expect(load(plugin, path.resolve('/otra/raiz', LIQUID_DEV_CONFIG))).toBe(EMPTY_JSON);
  });

  it('EMPTY_JSON es JSON válido y vacío', () => {
    // vite:json recibe esta cadena y la transforma como cualquier otro JSON.
    expect(JSON.parse(EMPTY_JSON)).toEqual({});
  });

  it('isLiquidDevConfig compara rutas, no cadenas', () => {
    expect(isLiquidDevConfig(path.join(ROOT, 'src/../src/config/liquid.json'), CONFIG_PATH)).toBe(true);
    expect(isLiquidDevConfig(path.join(ROOT, 'src/config/liquid.json.bak'), CONFIG_PATH)).toBe(false);
  });
});
