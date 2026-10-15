import path from 'node:path';

import type { Plugin } from 'vite';

/**
 * Vacía `src/config/liquid.json` en el bundle de producción.
 *
 * Ese archivo son los valores de desarrollo con los que `liquidParser` resuelve
 * `{{site.*}}`, `{{vars.*}}` y `{{user.*}}` en local. Al importarse de forma
 * estática desde `src/config/liquidConfig.ts`, Vite lo inlinea en el bundle y
 * todo lo que contenga (URLs internas, un realm, un `access_token` de pruebas)
 * se publica con el widget.
 *
 * No se puede resolver con `import.meta.env.DEV ? await import(...) : {}`: el
 * formato de salida es `iife` y no admite top-level await. Además la
 * inicialización tiene que seguir siendo síncrona, porque `widgetConfig.ts`
 * resuelve sus constantes en tiempo de módulo.
 *
 * El plugin intercepta el `load` del módulo y devuelve `{}` en su lugar. El
 * plugin `vite:json` recibe ese contenido y lo transforma como cualquier otro
 * JSON, así que el import estático sigue siendo válido y no hay que cambiar el
 * código. En producción `liquidParser` se queda sin librería y sin motor, que
 * es justo lo que se quiere: los tags viajan sin resolver y los reemplaza
 * Modyo en el servidor.
 *
 * Solo en build (`apply: 'build'`), como el resto de plugins locales. Con
 * `vite dev` y con el preview de Modyo CLI se siguen viendo los valores de
 * `liquid.json`.
 */

/** Ruta del archivo a vaciar, relativa a la raíz del proyecto. */
export const LIQUID_DEV_CONFIG = 'src/config/liquid.json';

/** Contenido que sustituye al archivo. JSON válido para que `vite:json` lo transforme. */
export const EMPTY_JSON = '{}';

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

  return {
    name: 'strip-liquid-dev-config',
    apply: 'build' as const,
    // Antes de `vite:json`, que es quien convierte el JSON en módulo.
    enforce: 'pre' as const,
    configResolved(config) {
      configPath = path.resolve(config.root, LIQUID_DEV_CONFIG);
    },
    load(id) {
      if (!isLiquidDevConfig(id, configPath)) {
        return null;
      }
      return EMPTY_JSON;
    },
  };
}
