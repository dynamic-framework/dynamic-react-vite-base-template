/**
 * Frontera de estilos: el widget no define colores, tipografía, radios ni
 * zonas de theme. Todo eso llega del CSS de Dynamic y del theme que carga el
 * sitio. Stylelint cubre los archivos de estilo; este test cubre además TS y
 * TSX (por ejemplo, `style={{ ... }}`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
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
  /**
   * Si es true, el patrón solo se busca dentro de los objetos de estilo de los
   * archivos TS/TSX. En CSS y SCSS esas propiedades las controla Stylelint.
   */
  styleObjectsOnly?: boolean;
  /** Si se indica, descarta las coincidencias para las que devuelve true. */
  allow?: (match: RegExpMatchArray) => boolean;
}

/** Apertura de un objeto de estilo: `style={{`, `style={ {` o `CSSProperties = {`. */
const STYLE_OBJECT_START = /style\s*=\s*\{\s*\{|CSSProperties\s*=\s*\{/g;

/**
 * Rangos [inicio, fin) del contenido de cada objeto de estilo. El cierre se
 * busca contando llaves fuera de los strings, así que una interpolación ${…},
 * una expresión o un objeto anidados no cortan el objeto.
 */
function styleObjectRanges(text: string): Array<[number, number]> {
  return [...text.matchAll(STYLE_OBJECT_START)].map((match) => {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let quote = '';
    let end = start;
    while (end < text.length && depth > 0) {
      const char = text[end];
      if (quote) {
        if (char === '\\') {
          end += 1;
        } else if (char === quote) {
          quote = '';
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      }
      end += 1;
    }
    return [start, end - 1];
  });
}

/** Clave de un objeto de estilo, con o sin comillas. */
function styleKey(keys: string): string {
  return String.raw`(?<![\w-])(["']?)(?:${keys})\1\s*:`;
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
    styleObjectsOnly: true,
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
    styleObjectsOnly: true,
    allow: (match) => isTokenShorthand(match[2].trim()),
  },
  {
    name: 'font-family',
    pattern: /font-?[Ff]amily["']?\s*[:=]/g,
    ignoreComments: false,
    hint: 'la tipografía viene del theme; usa las clases fs-* y fw-* de Dynamic',
  },
  {
    name: 'font en objetos de estilo',
    pattern: new RegExp(styleKey('font'), 'g'),
    ignoreComments: true,
    hint: 'la tipografía viene del theme; usa las clases fs-* y fw-* de Dynamic',
    styleObjectsOnly: true,
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

/** Hallazgos de una comprobación en un texto, como `línea  coincidencia`. */
function findInSource({
  pattern, ignoreComments, styleObjectsOnly, allow,
}: Check, source: string): string[] {
  const text = ignoreComments ? stripComments(source) : source;
  const ranges = styleObjectsOnly ? styleObjectRanges(text) : [[0, text.length]];
  return ranges.flatMap(([start, end]) => [...text.slice(start, end).matchAll(pattern)]
    .filter((match) => !allow?.(match))
    .map((match) => {
      const line = text.slice(0, start + (match.index ?? 0)).split('\n').length;
      return `${line}  ${match[0]}`;
    }));
}

function findViolations(check: Check): string[] {
  return files
    .filter(({ file }) => !check.styleObjectsOnly || /\.tsx?$/.test(file))
    .flatMap(({ file, source }) => findInSource(check, source).map((found) => `${file}:${found}`));
}

describe('frontera de estilos en src/', () => {
  it('recorre los archivos de src/', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some(({ file }) => file === path.join('src', 'app', 'main.tsx'))).toBe(true);
  });

  it.each(CHECKS)('src/ no contiene $name', (check) => {
    expect(
      findViolations(check),
      `src/ no puede contener ${check.name}: ${check.hint}.`,
    ).toEqual([]);
  });
});

/** Nombres de las comprobaciones que fallan con un fragmento de código. */
function failingChecks(source: string): string[] {
  return CHECKS.filter((check) => findInSource(check, source).length > 0).map(({ name }) => name);
}

const COLOR = 'colores fuera de var(--…) en objetos de estilo';
const SHORTHAND = 'colores en shorthands de objetos de estilo';
const FONT = 'font en objetos de estilo';

describe('detección de objetos de estilo', () => {
  it.each([
    {
      caso: 'propiedades después de una interpolación',
      source: "<div style={{ width: `${width}px`, color: 'red', font: '16px Arial' }} />",
      expected: [COLOR, FONT],
    },
    {
      caso: 'propiedades después de una expresión anidada',
      source: "<div style={{ ...(open ? { opacity: 1 } : {}), border: '1px solid red' }} />",
      expected: [SHORTHAND],
    },
    {
      caso: 'espacios entre las llaves',
      source: "<div style={ { color: 'red' } } />",
      expected: [COLOR],
    },
    {
      caso: 'CSSProperties con una interpolación previa',
      source: "const box: CSSProperties = { padding: `${gap}px`, background: 'white' };",
      expected: [COLOR],
    },
    {
      caso: 'valores con var(--…) después de una interpolación',
      source: "<div style={ { width: `${width}px`, color: 'var(--bs-body-color)', border: `${w}px solid var(--bs-border-color)` } } />",
      expected: [],
    },
    {
      caso: 'un objeto que no es de estilo',
      source: "const options = { color: 'red', font: 'Arial' };",
      expected: [],
    },
    {
      caso: 'texto después de cerrar el objeto de estilo',
      source: "<p style={{ width: `${width}px` }}>color: red</p>",
      expected: [],
    },
  ])('$caso', ({ source, expected }) => {
    expect(failingChecks(source)).toEqual(expected);
  });

  it('indica la línea de una propiedad en un objeto de varias líneas', () => {
    const source = "<div\n  style={{\n    width: `${width}px`,\n    color: 'red',\n  }}\n/>";
    const check = CHECKS.find(({ name }) => name === COLOR);

    expect(check && findInSource(check, source)).toEqual(["4  color: 'red'"]);
  });
});
