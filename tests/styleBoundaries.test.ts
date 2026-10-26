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
  /** Si se indica, la comprobación solo recorre archivos con estas extensiones. */
  extensions?: string[];
  /** Si se indica, descarta las coincidencias para las que devuelve true. */
  allow?: (match: RegExpMatchArray) => boolean;
}

/**
 * Clave (con o sin comillas) de un objeto de estilo de TS/TSX:
 * `style={{ ... }}` o un objeto tipado como CSSProperties.
 */
function styleKey(keys: string): string {
  return String.raw`(?<=(?:style=\{\{|CSSProperties\s*=\s*\{)[^{}]*)(?<![\w-])(["']?)(?:${keys})\1\s*:`;
}

/** Medidas y palabras clave sin color de border, outline y las sombras. */
const SHORTHAND_TOKEN = /^(?:-?\d*\.?\d+(?:px|rem|em|%|vh|vw)?|thin|medium|thick|none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/;

/**
 * Un shorthand se acepta si es un número o si, quitando los var(--…), solo
 * quedan medidas y palabras clave: el color tiene que venir de un var(--…).
 * Una interpolación ${…} fuera de un var(--…) solo vale seguida de una unidad
 * (${width}px); en cualquier otro sitio podría ser un color y se rechaza.
 */
function isTokenShorthand(value: string): boolean {
  if (/^-?\d*\.?\d+$/.test(value)) {
    return true;
  }
  if (!/^(["'`]).*\1$/s.test(value)) {
    return false;
  }
  const rest = value
    .slice(1, -1)
    .replace(/var\((?:[^()]|\([^()]*\))*\)/g, ' ')
    .replace(/\$\{[^}]*\}(?=px|rem|em|%|vh|vw)/g, '0');
  return rest.split(/[\s,]+/).filter(Boolean).every((token) => SHORTHAND_TOKEN.test(token));
}

const CHECKS: Check[] = [
  {
    name: 'colores hex',
    pattern: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
    ignoreComments: false,
    hint: 'usa var(--bs-*) de Dynamic, por ejemplo rgb(var(--bs-primary-rgb))',
  },
  {
    // En los objetos de estilo de TS/TSX (style={{ ... }} o un CSSProperties),
    // las propiedades de color solo aceptan var(--…). En CSS y SCSS los colores
    // los controla Stylelint.
    name: 'colores fuera de var(--…) en objetos de estilo',
    pattern: new RegExp(
      `${styleKey('color|background|backgroundColor|border(?:Top|Right|Bottom|Left|Block|Inline)?(?:Start|End)?Color|outlineColor|fill|stroke')}(?!\\s*["'\`]var\\(--)[^,}\\n]*`,
      'g',
    ),
    ignoreComments: true,
    hint: "usa var(--bs-*) de Dynamic, por ejemplo color: 'var(--bs-body-color)'",
    extensions: ['.ts', '.tsx'],
  },
  {
    // Los shorthands que llevan color (border, outline, sombras) solo admiten
    // medidas, palabras clave y var(--…), por ejemplo
    // border: '1px solid var(--bs-border-color)'.
    name: 'colores en shorthands de objetos de estilo',
    pattern: new RegExp(
      `${styleKey('border(?:Top|Right|Bottom|Left|Block|Inline)?(?:Start|End)?|outline|boxShadow|textShadow')}\\s*("[^"]*"|'[^']*'|\`[^\`]*\`|[^,}\\n]*)`,
      'g',
    ),
    ignoreComments: true,
    hint: "el color va con var(--bs-*), por ejemplo border: '1px solid var(--bs-border-color)'",
    extensions: ['.ts', '.tsx'],
    allow: (match) => isTokenShorthand(match[2].trim()),
  },
  {
    // font-family en cualquier archivo; el shorthand font, en objetos de estilo.
    name: 'font-family ni font',
    pattern: new RegExp(`font-?[Ff]amily["']?\\s*[:=]|${styleKey('font')}`, 'g'),
    ignoreComments: false,
    hint: 'la tipografía viene del theme; usa las clases fs-* y fw-* de Dynamic',
  },
  {
    name: 'border-radius',
    pattern: /border-?(?:[A-Za-z]+-?){0,2}[Rr]adius["']?\s*[:=]/g,
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
    // Con o sin valor y con espacios dentro de los corchetes. El atributo
    // data-bs-theme="…" en el JSX no lleva corchetes y sigue permitido.
    name: 'una zona [data-bs-theme]',
    pattern: /\[\s*data-bs-theme\s*(?:[~|^$*]?=\s*(?:"[^"]*"|'[^']*'|[\w-]+)\s*(?:[iIsS]\s*)?)?\]/g,
    ignoreComments: true,
    hint: 'las zonas las define el theme del sitio; el widget solo pone el atributo en el JSX',
  },
];

function findViolations({
  pattern, ignoreComments, extensions, allow,
}: Check): string[] {
  return files.flatMap(({ file, source }) => {
    if (extensions && !extensions.some((ext) => file.endsWith(ext))) {
      return [];
    }
    const text = ignoreComments ? stripComments(source) : source;
    return [...text.matchAll(pattern)].filter((match) => !allow?.(match)).map((match) => {
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
