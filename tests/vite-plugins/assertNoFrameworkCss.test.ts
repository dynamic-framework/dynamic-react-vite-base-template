import type { OutputBundle } from 'rollup';
import { describe, expect, it } from 'vitest';

import assertNoFrameworkCss, {
  checkCssAssets,
  collectCssAssets,
  FRAMEWORK_CSS_MARKER,
} from '../../.vite/plugins/assertNoFrameworkCss';

/** Bundle minimo con los campos que mira el plugin. */
function bundleWith(files: Record<string, string | Uint8Array>): OutputBundle {
  const bundle: Record<string, unknown> = {};
  for (const [fileName, source] of Object.entries(files)) {
    bundle[fileName] = {
      type: 'asset', fileName, source, names: [fileName],
    };
  }
  // Un chunk de JS, para comprobar que no se confunde con un asset.
  bundle['main.js'] = { type: 'chunk', fileName: 'main.js', code: FRAMEWORK_CSS_MARKER };
  return bundle as unknown as OutputBundle;
}

const CSS_PROPIO = '.widget-name{background-color:rgb(var(--bs-secondary-soft-rgb))}';
const CSS_DYNAMIC = `:root{${FRAMEWORK_CSS_MARKER}:13,110,253}`;

describe('collectCssAssets', () => {
  it('recoge solo los assets .css', () => {
    const assets = collectCssAssets(bundleWith({
      'main.css': CSS_PROPIO,
      'logo.svg': '<svg/>',
    }));

    expect(assets).toEqual([{ fileName: 'main.css', source: CSS_PROPIO }]);
  });

  it('decodifica un asset binario', () => {
    const assets = collectCssAssets(bundleWith({
      'main.css': new TextEncoder().encode(CSS_PROPIO),
    }));

    expect(assets[0].source).toBe(CSS_PROPIO);
  });

  it('ignora los chunks de JS aunque contengan el token', () => {
    // El token dentro de main.js no es el CSS del framework; no debe disparar.
    const assets = collectCssAssets(bundleWith({ 'main.css': CSS_PROPIO }));

    expect(assets.map(({ fileName }) => fileName)).toEqual(['main.css']);
  });
});

describe('checkCssAssets', () => {
  it('pasa con el CSS propio del widget', () => {
    expect(checkCssAssets([{ fileName: 'main.css', source: CSS_PROPIO }])).toBeUndefined();
  });

  it('falla si el CSS de Dynamic acabo dentro', () => {
    const problema = checkCssAssets([{ fileName: 'main.css', source: CSS_DYNAMIC }]);

    expect(problema).toContain('main.css');
    expect(problema).toContain(FRAMEWORK_CSS_MARKER);
  });

  it('nombra todos los archivos afectados', () => {
    const problema = checkCssAssets([
      { fileName: 'main.css', source: CSS_DYNAMIC },
      { fileName: 'otro.css', source: CSS_DYNAMIC },
    ]);

    expect(problema).toContain('main.css, otro.css');
  });

  describe('requireCss', () => {
    // Protege al chequeo de si mismo: sin CSS emitido, buscar la ausencia del
    // token pasaria en vacio. Esto atrapo un bug real de orden de hooks: sin
    // `order: post` el plugin corria antes de que vite:css-post emitiera el CSS.
    it('falla si no se emitio ningun CSS', () => {
      expect(checkCssAssets([])).toContain('no emitio ningun CSS');
    });

    it('falla si el CSS emitido esta vacio', () => {
      expect(checkCssAssets([{ fileName: 'main.css', source: '   \n' }]))
        .toContain('no emitio ningun CSS');
    });

    it('se puede desactivar para un widget sin estilos propios', () => {
      expect(checkCssAssets([], { requireCss: false })).toBeUndefined();
    });

    it('el token manda sobre requireCss', () => {
      // Aunque se pida no exigir CSS, el framework dentro sigue siendo un error.
      expect(checkCssAssets([{ fileName: 'main.css', source: CSS_DYNAMIC }], { requireCss: false }))
        .toContain(FRAMEWORK_CSS_MARKER);
    });
  });

  it('acepta un token propio', () => {
    expect(checkCssAssets([{ fileName: 'main.css', source: '.a{--mi-token:1}' }], { marker: '--mi-token' }))
      .toContain('--mi-token');
  });
});

describe('assertNoFrameworkCss', () => {
  it('solo corre en build y despues de que se emita el CSS', () => {
    const plugin = assertNoFrameworkCss();

    expect(plugin.name).toBe('assert-no-framework-css');
    expect(plugin.apply).toBe('build');
    // `vite:css-post` emite el CSS en generateBundle; sin `post` este hook
    // veria un bundle todavia sin CSS.
    expect(plugin.generateBundle).toMatchObject({ order: 'post' });
  });
});
