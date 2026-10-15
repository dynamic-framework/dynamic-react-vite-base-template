import path from 'node:path';

import { describe, expect, it } from 'vitest';

import stripLiquidDevConfig, {
  EMPTY_JSON,
  ENGINE_FLAG,
  isLiquidDevConfig,
  LIQUID_DEV_CONFIG,
} from '../../.vite/plugins/stripLiquidDevConfig';

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.resolve(ROOT, LIQUID_DEV_CONFIG);

type AnyHook = (...args: unknown[]) => unknown;
const hook = (plugin: unknown, name: string) => (plugin as Record<string, AnyHook>)[name];

/** Plugin con los hooks de configuración ya aplicados, como lo deja Vite. */
function makePlugin(command: 'build' | 'serve', mode = 'production') {
  const plugin = stripLiquidDevConfig();
  const config = hook(plugin, 'config')({}, { command, mode }) as {
    define: Record<string, string>;
  };
  hook(plugin, 'configResolved')({ root: ROOT });
  return { plugin, define: config.define };
}

const load = (plugin: unknown, id: string) => hook(plugin, 'load')(id);

/** Modos propios: el bug original solo aparecía fuera de `production`. */
const MODOS = ['production', 'staging', 'development', 'qa'];

describe('stripLiquidDevConfig', () => {
  it('corre antes de vite:json', () => {
    const plugin = stripLiquidDevConfig();
    expect(plugin.name).toBe('strip-liquid-dev-config');
    expect(plugin.enforce).toBe('pre');
  });

  describe('apaga el motor de Liquid en todo build, sea cual sea el modo', () => {
    it.each(MODOS)('build --mode %s', (mode) => {
      expect(makePlugin('build', mode).define[ENGINE_FLAG]).toBe('false');
    });

    it.each(MODOS)('serve --mode %s lo deja encendido', (mode) => {
      expect(makePlugin('serve', mode).define[ENGINE_FLAG]).toBe('true');
    });

    it('define el flag siempre, para no necesitar un guard con typeof', () => {
      expect(makePlugin('serve').define).toHaveProperty(ENGINE_FLAG);
      expect(makePlugin('build').define).toHaveProperty(ENGINE_FLAG);
    });
  });

  describe('vacía liquid.json en todo build, sea cual sea el modo', () => {
    it.each(MODOS)('build --mode %s', (mode) => {
      expect(load(makePlugin('build', mode).plugin, CONFIG_PATH)).toBe(EMPTY_JSON);
    });

    it.each(MODOS)('serve --mode %s mantiene los valores', (mode) => {
      expect(load(makePlugin('serve', mode).plugin, CONFIG_PATH)).toBeNull();
    });
  });

  it('el motor y la configuración se apagan juntos', () => {
    // Vaciar la configuración dejando el motor encendido convierte los tags en
    // mensajes de error; esta es la invariante que lo impide.
    for (const command of ['build', 'serve'] as const) {
      const { plugin, define } = makePlugin(command);
      const motorEncendido = define[ENGINE_FLAG] === 'true';
      const configIntacta = load(plugin, CONFIG_PATH) === null;
      expect(motorEncendido, command).toBe(configIntacta);
    }
  });

  it('ignora el query que Vite añade al id', () => {
    expect(load(makePlugin('build').plugin, `${CONFIG_PATH}?import`)).toBe(EMPTY_JSON);
  });

  it('no toca ningún otro módulo', () => {
    const { plugin } = makePlugin('build');
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
    hook(plugin, 'config')({}, { command: 'build', mode: 'production' });
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
