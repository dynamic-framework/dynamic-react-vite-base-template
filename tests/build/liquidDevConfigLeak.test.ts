import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import liquidDevConfig from '../../src/config/liquid.json';

const BUNDLE = path.resolve(__dirname, '../../dist/main.js');

type Needle = {
  text: string;
  /** Las claves se buscan como token completo; los valores como subcadena. */
  kind: 'key' | 'value';
};

/**
 * Extrae de `liquid.json` las cadenas lo bastante distintivas como para probar
 * que el archivo acabó dentro del bundle:
 *
 * - valores string de 6 caracteres o más (`"true"` o `"$"` coincidirían con
 *   cualquier bundle por puro azar),
 * - claves anidadas que contengan `-` o `_`, que es la forma de las variables
 *   de Modyo y de los campos de usuario (`api-base-url`, `access_token`).
 */
export function collectNeedles(value: unknown, isRoot = true): Needle[] {
  if (typeof value === 'string') {
    return value.length >= 6 ? [{ text: value, kind: 'value' }] : [];
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]): Needle[] => [
    ...(!isRoot && /[-_]/.test(key) ? [{ text: key, kind: 'key' } as Needle] : []),
    ...collectNeedles(child, false),
  ]);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matches(bundle: string, { text, kind }: Needle) {
  if (kind === 'value') {
    return bundle.includes(text);
  }
  // Token completo: `currency-symbol` no debe saltar por la variable CSS
  // `input-currency-symbol-color` que trae @dynamic-framework/ui-react.
  return new RegExp(`(?<![\\w$-])${escapeRegExp(text)}(?![\\w$-])`).test(bundle);
}

/** Los tags `{{vars.api-base-url}}` sí viajan en el bundle a propósito. */
export function stripLiquidTags(bundle: string) {
  return bundle.replace(/\{\{[\s\S]*?\}\}/g, '');
}

const needles = collectNeedles(liquidDevConfig)
  .filter((needle, i, all) => all.findIndex((other) => other.text === needle.text) === i);

describe('liquid.json no debe llegar al bundle de producción', () => {
  it('encuentra al menos un valor detectable en liquid.json', () => {
    // Protege al propio test: sin needles pasaría en vacío.
    expect(needles.length).toBeGreaterThan(0);
  });

  it.skipIf(!existsSync(BUNDLE))('dist/main.js no contiene ningún valor de liquid.json', () => {
    const bundle = stripLiquidTags(readFileSync(BUNDLE, 'utf8'));
    const filtrados = needles.filter((needle) => matches(bundle, needle)).map(({ text }) => text);

    expect(filtrados, `Filtrado desde src/config/liquid.json a dist/main.js: ${filtrados.join(', ')}`)
      .toEqual([]);
  });

  it('detecta el objeto si alguien lo vuelve a inlinear', () => {
    // Control negativo: el mismo chequeo sobre un bundle con el leak dentro.
    const conLeak = stripLiquidTags(`var liquidConfig=${JSON.stringify(liquidDevConfig)};`);
    expect(needles.some((needle) => matches(conLeak, needle))).toBe(true);
  });
});

if (!existsSync(BUNDLE)) {
  console.warn('[liquidDevConfigLeak] no existe dist/main.js — ejecuta `npm run build` para que corra este chequeo.');
}
