/**
 * Frontera de estilos: el widget no define colores, tipografía, radios ni
 * zonas de theme. Todo eso llega del CSS de Dynamic y del theme que carga el
 * sitio. Stylelint cubre los archivos de estilo; este test cubre además TS y
 * TSX (por ejemplo, `style={{ ... }}`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const EXTENSIONS = ['.ts', '.tsx', '.css', '.scss'];

/**
 * Sustituye los comentarios por espacios y conserva los saltos de línea, para
 * que el número de línea de cada hallazgo siga siendo el del archivo.
 */
function stripComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|\s)(\/\/.*)$/gm, (_, before: string, comment: string) => before + blank(comment));
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return EXTENSIONS.some((ext) => entry.endsWith(ext)) ? [full] : [];
  });
}

const files = walk(SRC).map((file) => ({
  file: path.relative(ROOT, file),
  source: readFileSync(file, 'utf8'),
}));

interface Check {
  name: string;
  pattern: RegExp;
  ignoreComments: boolean;
  hint: string;
}

const CHECKS: Check[] = [
  {
    name: 'colores hex',
    pattern: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
    ignoreComments: false,
    hint: 'usa var(--bs-*) de Dynamic, por ejemplo rgb(var(--bs-primary-rgb))',
  },
  {
    name: 'font-family',
    pattern: /font-?[Ff]amily\s*[:=]/g,
    ignoreComments: false,
    hint: 'la tipografía viene del theme; usa las clases fs-* y fw-* de Dynamic',
  },
  {
    name: 'border-radius',
    pattern: /border-?(?:[A-Za-z]+-?){0,2}[Rr]adius\s*[:=]/g,
    ignoreComments: false,
    hint: 'los radios vienen del theme; usa las clases rounded-* de Dynamic',
  },
  {
    // El parcial abstracts/+import solo expone funciones y mixins (por ejemplo,
    // media-breakpoint-up) y no emite CSS, así que se permite. Cualquier otra
    // entrada de src/style compila el CSS de Dynamic dentro de dist/main.css.
    name: 'el CSS de Dynamic',
    pattern: /dynamic-ui(?:\.min)?\.css|@dynamic-framework\/ui-react\/src\/style(?!\/abstracts\/_?\+import(?:\.scss)?["'])/g,
    ignoreComments: true,
    hint: 'lo carga el sitio; el widget solo importa sus estilos propios',
  },
  {
    name: 'una zona [data-bs-theme=…]',
    pattern: /\[data-bs-theme\s*[~|^$*]?=\s*["']?[\w-]+["']?\]/g,
    ignoreComments: true,
    hint: 'las zonas las define el theme del sitio; el widget solo pone el atributo en el JSX',
  },
];

function findViolations({ pattern, ignoreComments }: Check): string[] {
  return files.flatMap(({ file, source }) => {
    const text = ignoreComments ? stripComments(source) : source;
    return [...text.matchAll(pattern)].map((match) => {
      const line = text.slice(0, match.index).split('\n').length;
      return `${file}:${line}  ${match[0]}`;
    });
  });
}

describe('frontera de estilos en src/', () => {
  it('recorre los archivos de src/', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some(({ file }) => file === path.join('src', 'main.tsx'))).toBe(true);
  });

  it.each(CHECKS)('src/ no contiene $name', (check) => {
    expect(
      findViolations(check),
      `src/ no puede contener ${check.name}: ${check.hint}.`,
    ).toEqual([]);
  });
});
