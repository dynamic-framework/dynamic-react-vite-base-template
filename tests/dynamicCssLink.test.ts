/**
 * El `<link>` de desarrollo de index.html.
 *
 * Dos invariantes que, si se rompen, no fallan en ningun otro sitio:
 *
 *  1. La URL tiene que ser **absoluta**. Es lo unico que la mantiene fuera del
 *     bundle: una ruta a node_modules la resuelve Vite y acaba dentro de
 *     dist/main.css (medido: 1 278 396 B en vez de 65).
 *  2. La version tiene que ir alineada con el paquete instalado. Es el precio
 *     de escribirla a mano, y es justo lo que este test paga.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');

const indexHtml = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/** Solo los `<link>` activos: los de dentro de un comentario no cuentan. */
function activeLinks(html: string): string[] {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .match(/<link\b[^>]*>/g) ?? [];
}

const dynamicLink = activeLinks(indexHtml)
  .find((link) => link.includes('ui-react') && link.includes('dynamic-ui'));

function installedVersion(): string {
  const pkg = path.join(ROOT, 'node_modules/@dynamic-framework/ui-react/package.json');
  return JSON.parse(readFileSync(pkg, 'utf8')).version as string;
}

describe('el <link> de Dynamic en index.html', () => {
  it('existe y está activo', () => {
    expect(dynamicLink, 'falta el <link> al CSS de Dynamic en index.html').toBeDefined();
  });

  it('usa una URL absoluta, para quedar fuera del bundle', () => {
    const href = /href="([^"]+)"/.exec(dynamicLink ?? '')?.[1];

    expect(href, 'el <link> no tiene href').toBeDefined();
    expect(
      /^https:\/\//.test(href ?? ''),
      `href debe ser una URL absoluta https:// — una ruta local la resuelve Vite `
      + `y acaba dentro de dist/main.css. Encontrado: ${href}`,
    ).toBe(true);
  });

  it('apunta a la misma versión de @dynamic-framework/ui-react que está instalada', () => {
    const enElLink = /\/assets\/([^/]+)\/ui-react\//.exec(dynamicLink ?? '')?.[1];
    const instalada = installedVersion();

    expect(
      enElLink,
      'no se pudo leer la versión del href; ¿cambió el formato de la URL del CDN?',
    ).toBeDefined();
    expect(
      enElLink,
      `index.html enlaza Dynamic ${enElLink} pero hay instalada la ${instalada}. `
      + 'Actualiza el <link> de index.html o la dependencia.',
    ).toBe(instalada);
  });
});

describe('el CSS del framework no se importa desde el código', () => {
  it('main.tsx solo importa los estilos propios', () => {
    const mainTsx = readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');

    // Es la regresion mas facil de cometer: volver a poner el import "porque en
    // dev no se veia". El guard del build tambien lo caza, pero esto lo dice
    // antes y senala el archivo.
    expect(mainTsx).not.toContain('dynamic-ui.css');
  });
});
