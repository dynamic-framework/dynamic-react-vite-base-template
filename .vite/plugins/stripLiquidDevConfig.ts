import path from 'node:path';

import type { Plugin } from 'vite';

/**
 * Deja fuera del bundle todo el andamiaje de Liquid que solo sirve en local:
 * los valores de `src/config/liquid.json` y el motor de `liquidjs`.
 *
 * `liquid.json` son los valores con los que `liquidParser` resuelve
 * `{{site.*}}`, `{{vars.*}}` y `{{user.*}}` mientras desarrollas. Al importarse
 * de forma estática desde `src/config/liquidConfig.ts`, Vite lo inlinea en el
 * bundle y todo lo que contenga (URLs internas, un realm, un `access_token` de
 * pruebas) se publica con el widget.
 *
 * Las dos cosas tienen que apagarse juntas y por el mismo interruptor. Vaciar
 * la configuración dejando el motor encendido es peor que no hacer nada: con
 * `strictVariables: true`, `{{site.language}}` no sobrevive intacto para que lo
 * resuelva Modyo, sino que se convierte en el string "undefined variable:
 * site, line:1, col:3".
 *
 * Ese interruptor es `command === 'build'`, no el modo ni `import.meta.env.DEV`:
 *
 *  - `MODE !== 'production'` deja el motor encendido en cualquier modo propio
 *    (`vite build --mode staging`).
 *  - `import.meta.env.DEV` se deriva de `NODE_ENV`, así que `NODE_ENV=development
 *    vite build` también lo dejaría encendido.
 *
 * `command` solo distingue entre servir y construir, que es justo la pregunta.
 *
 * El plugin hace dos cosas, ambas solo en build:
 *
 *  1. Intercepta el `load` de `liquid.json` y devuelve `{}`. Como corre antes
 *     de `vite:json` (`enforce: 'pre'`), este transforma ese contenido como
 *     cualquier otro JSON y el import estático sigue siendo válido: no hay que
 *     tocar el código ni usar `await import()`, que el formato `iife` no admite.
 *  2. Define `__LIQUID_DEV_ENGINE__` como `false`, lo que apaga el motor en
 *     `liquidConfig.ts` y deja `liquidjs` fuera del bundle por tree-shaking.
 *
 * Con `vite dev`, con vitest y con el preview de Modyo CLI el flag es `true` y
 * se siguen viendo los valores de `liquid.json` resueltos.
 */

/** Ruta del archivo a vaciar, relativa a la raíz del proyecto. */
export const LIQUID_DEV_CONFIG = 'src/config/liquid.json';

/** Contenido que sustituye al archivo. JSON válido para que `vite:json` lo transforme. */
export const EMPTY_JSON = '{}';

/** Flag que consume `src/config/liquidConfig.ts` para encender o no el motor. */
export const ENGINE_FLAG = '__LIQUID_DEV_ENGINE__';

/**
 * Compara el id de un módulo con la ruta del archivo, ignorando el query que
 * Vite añade en algunos casos (`?import`, `?raw`, ...).
 */
export function isLiquidDevConfig(id: string, configPath: string): boolean {
  const [filePath] = id.split('?');
  return path.resolve(filePath) === configPath;
}

export default function stripLiquidDevConfig(): Plugin {
  let configPath = path.resolve(process.cwd(), LIQUID_DEV_CONFIG);
  let isBuild = false;

  return {
    name: 'strip-liquid-dev-config',
    // Antes de `vite:json`, que es quien convierte el JSON en módulo.
    enforce: 'pre' as const,
    config(_config, env) {
      isBuild = env.command === 'build';
      // Se define siempre, en los dos sentidos, para que el identificador
      // exista también al servir y no haga falta un guard con `typeof`.
      return { define: { [ENGINE_FLAG]: String(!isBuild) } };
    },
    configResolved(config) {
      configPath = path.resolve(config.root, LIQUID_DEV_CONFIG);
    },
    load(id) {
      if (!isBuild || !isLiquidDevConfig(id, configPath)) {
        return null;
      }
      return EMPTY_JSON;
    },
  };
}
