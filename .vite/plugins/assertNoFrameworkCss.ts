import type { OutputBundle } from 'rollup';
import type { Plugin } from 'vite';

/**
 * Falla el build si el CSS del framework acabo dentro del CSS del widget.
 *
 * En Modyo el sitio carga el CSS de Dynamic y el theme una vez para toda la
 * pagina. Si cada widget se lo lleva dentro, pasan tres cosas: con N widgets se
 * descargan N copias de mas (1,2 MB cada una), cada copia redeclara `:root` con
 * los valores por defecto de Dynamic y pisa los tokens del theme segun el orden
 * de los enlaces, y un widget con otra version de Dynamic mete dos `:root`
 * distintos en la misma pagina.
 *
 * Es un plugin y no un test a proposito: asi corre en todo build, incluido el
 * de `npm run push`, sin depender de que los tests se ejecuten despues del
 * build en CI.
 *
 * La trampa que vigila no es solo `import 'dynamic-ui.css'` en el codigo: un
 * `<link href="/node_modules/...">` en index.html lo resuelve Vite y acaba
 * igualmente en el bundle. Por eso el enlace de desarrollo tiene que ser una
 * URL absoluta.
 */

/**
 * Primera declaracion del CSS de Dynamic. Se busca este token y no el nombre
 * del paquete porque lo que importa es el contenido, venga por donde venga.
 */
export const FRAMEWORK_CSS_MARKER = '--bs-blue-rgb';

export type AssertNoFrameworkCssOptions = {
  /** Token a buscar. Por defecto {@link FRAMEWORK_CSS_MARKER}. */
  marker?: string;
  /**
   * Exige que el build emita al menos un CSS no vacio. Por defecto `true`.
   *
   * Protege al propio chequeo: si el pipeline de SCSS se rompe y no se emite
   * CSS, un guard que solo busca la ausencia del token pasaria tan campante.
   * Ponlo en `false` si tu widget de verdad no lleva ningun estilo propio.
   */
  requireCss?: boolean;
};

const isCssAsset = (fileName: string) => fileName.endsWith('.css');

/** Devuelve los CSS emitidos y su contenido. Puro, para poder testearlo. */
export function collectCssAssets(bundle: OutputBundle): Array<{ fileName: string; source: string }> {
  const assets: Array<{ fileName: string; source: string }> = [];
  // for...of y no filter().map(): el filter no estrecha la union
  // OutputAsset | OutputChunk, y `source` solo existe en la primera.
  for (const item of Object.values(bundle)) {
    if (item.type !== 'asset' || !isCssAsset(item.fileName)) {
      continue;
    }
    assets.push({
      fileName: item.fileName,
      source: typeof item.source === 'string'
        ? item.source
        : new TextDecoder().decode(item.source),
    });
  }
  return assets;
}

/**
 * Decide si el bundle pasa. Devuelve el mensaje de error, o `undefined` si todo
 * bien. Separado del hook para poder ejercitarlo sin Rollup.
 */
export function checkCssAssets(
  assets: Array<{ fileName: string; source: string }>,
  { marker = FRAMEWORK_CSS_MARKER, requireCss = true }: AssertNoFrameworkCssOptions = {},
): string | undefined {
  const conMarcador = assets.filter((asset) => asset.source.includes(marker));

  if (conMarcador.length > 0) {
    const nombres = conMarcador.map((asset) => asset.fileName).join(', ');
    return `${nombres} contiene "${marker}": el CSS de Dynamic acabo dentro del widget. `
      + 'El sitio de Modyo ya lo carga para toda la pagina. Revisa que nadie importe '
      + 'dynamic-ui.css desde src/, y que el <link> de index.html sea una URL '
      + 'absoluta (una ruta a node_modules la resuelve Vite y la mete en el bundle).';
  }

  if (requireCss) {
    const conContenido = assets.filter((asset) => asset.source.trim().length > 0);
    if (conContenido.length === 0) {
      return 'El build no emitio ningun CSS con contenido. Si eso es intencional '
        + 'porque el widget no lleva estilos propios, pasa `requireCss: false` a '
        + 'assertNoFrameworkCss() en vite.config.ts. Si no, el pipeline de SCSS '
        + 'esta roto y este chequeo se quedaria sin nada que vigilar.';
    }
  }

  return undefined;
}

export default function assertNoFrameworkCss(
  options: AssertNoFrameworkCssOptions = {},
): Plugin {
  return {
    name: 'assert-no-framework-css',
    apply: 'build' as const,
    generateBundle: {
      // `post` es imprescindible: el CSS lo emite `vite:css-post`, asi que un
      // generateBundle normal corre antes de que el asset exista y veria un
      // bundle sin CSS. (Lo detecto `requireCss` en vez de pasar en silencio.)
      order: 'post',
      handler(_options, bundle) {
        const problema = checkCssAssets(collectCssAssets(bundle), options);
        if (problema !== undefined) {
          this.error(problema);
        }
      },
    },
  };
}
