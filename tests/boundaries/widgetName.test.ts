// @vitest-environment node
/**
 * El nombre de montaje del widget (`data-widget`, el `id` del contenedor y el
 * prefijo de las clases propias) se deriva de `name` en package.json.
 *
 * Antes vivía repetido como literal en src/app/main.tsx, index.html,
 * src/styles/base.scss y la configuración de Stylelint, sin que nada
 * comprobara que coincidían. Dos widgets creados del template sin renombrar
 * montaban los dos en `widgetName`: el primer bundle ocupaba también los
 * contenedores del otro y el segundo no aparecía, sin errores en consola.
 *
 * Estos tests mantienen de acuerdo a los cuatro sitios.
 */
import {
  mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import stylelint from 'stylelint';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

import { normalizeWidgetName, readPackageName, resolveWidgetName } from '../../.vite/widgetName';

const ROOT = path.resolve(__dirname, '../..');

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), 'utf8');
}

const BASE_SCSS = 'src/styles/base.scss';

/** Patrón que ninguna clase literal puede cumplir. */
const NO_LITERAL = '^(?!)';

/** El config de Stylelint del proyecto, que trae el parser de SCSS. */
async function projectConfig(): Promise<stylelint.Config> {
  const config = await stylelint.resolveConfig(path.join(ROOT, BASE_SCSS));

  if (!config) {
    throw new Error('Stylelint no resolvió configuración para ' + BASE_SCSS);
  }

  return config;
}

/**
 * Clases escritas como literal, es decir sin interpolación `#{…}`.
 *
 * Lo resuelve Stylelint en lugar de un parser propio: ya es dependencia, ya
 * sabe leer SCSS y ya distingue un nodo de clase del resto. Se le pasa el
 * config del proyecto —de ahí sale el parser— con `selector-class-pattern`
 * sustituido por un patrón imposible, así que avisa de toda clase literal y
 * calla ante las interpoladas, que no evalúa.
 *
 * Buscar por texto no servía: `content: ".pdf"` parece una clase y no lo es, y
 * en `div.acme-checkout` la clase va pegada a una etiqueta.
 */
export async function literalClassSelectors(scss: string): Promise<string[]> {
  const config = await projectConfig();
  const { results } = await stylelint.lint({
    code: scss,
    codeFilename: 'probe.scss',
    config: { ...config, rules: { ...config.rules, 'selector-class-pattern': NO_LITERAL } },
  });

  return results[0].warnings
    .filter((warning) => warning.rule === 'selector-class-pattern')
    .map((warning) => warning.text.match(/"\.([^"]+)"/)?.[1] ?? warning.text);
}

const WIDGET_NAME = resolveWidgetName(ROOT);
const PLACEHOLDER = '%VITE_WIDGET_NAME%';

describe('normalizeWidgetName', () => {
  it.each([
    ['@acme/checkout', 'acme-checkout'],
    ['checkout-widget', 'checkout-widget'],
    ['myWidget', 'my-widget'],
    ['@acme/MyWidget', 'acme-my-widget'],
    ['widget_name', 'widget-name'],
  ])('normaliza %s a %s', (input, expected) => {
    expect(normalizeWidgetName(input)).toBe(expected);
  });

  it('pliega el scope en lugar de descartarlo, para que dos orgs no choquen', () => {
    expect(normalizeWidgetName('@acme/checkout'))
      .not.toBe(normalizeWidgetName('@globex/checkout'));
  });

  /**
   * Límite conocido y aceptado: `-`, `.`, `_` y `/` colapsan todos en `-`, así
   * que estos pares comparten nombre de montaje y, en una misma página, se
   * ocuparían los contenedores entre sí.
   *
   * El test fija el comportamiento en lugar de taparlo. Evitarlo pedía un
   * sufijo hash en el identificador de todos los widgets, demasiado precio por
   * un naming rebuscado; y el fallo ya no es silencioso, porque el widget sin
   * contenedor avisa por consola. Ver el comentario de normalizeWidgetName.
   *
   * Si alguna vez se decide cerrarlo, estos casos son la especificación: basta
   * con invertirlos a `not.toBe`.
   */
  it.each([
    ['@acme/checkout', 'acme-checkout'],
    ['@acme/checkout-cart', '@acme-checkout/cart'],
    ['@a-b/c', '@a.b/c'],
  ])('LÍMITE: %s y %s caen en el mismo nombre', (one, other) => {
    expect(normalizeWidgetName(one)).toBe(normalizeWidgetName(other));
  });

  it('antepone w- cuando el nombre empieza por un dígito, que no vale como clase', () => {
    expect(normalizeWidgetName('123widget')).toBe('w-123widget');
  });

  it('rechaza un nombre sin ningún carácter válido', () => {
    expect(() => normalizeWidgetName('@/')).toThrow(/ningún carácter válido/);
  });
});

describe('nombre de montaje derivado', () => {
  it('sale de name en package.json', () => {
    expect(WIDGET_NAME).toBe(normalizeWidgetName(readPackageName(ROOT)));
  });

  it('sirve a la vez como id, como clase CSS y como valor de atributo', () => {
    expect(WIDGET_NAME).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});

describe('index.html', () => {
  const html = read('index.html');

  it.each(['id', 'data-widget', 'class'])('%s usa el placeholder inyectado', (attribute) => {
    expect(html).toContain(`${attribute}="${PLACEHOLDER}"`);
  });

  it('no fija el nombre como literal', () => {
    expect(html).not.toContain(`"${WIDGET_NAME}"`);
  });
});

describe('src/app/main.tsx', () => {
  const source = read('src/app/main.tsx');

  it('lee el nombre inyectado', () => {
    expect(source).toContain('import.meta.env.VITE_WIDGET_NAME');
  });

  it('no declara un respaldo literal, que reintroduciría el choque', () => {
    expect(source).not.toMatch(/const WIDGET_NAME\s*=\s*['"`]/);
  });
});

describe('estilos', () => {
  /**
   * Se resuelve con la API de Stylelint en lugar de importar el archivo de
   * configuración, para comprobar el patrón que Stylelint aplica de verdad.
   */
  async function classPattern(): Promise<RegExp> {
    const config = await projectConfig();
    const rule = config.rules?.['selector-class-pattern'];
    const source = Array.isArray(rule) ? rule[0] : rule;

    expect(typeof source, 'selector-class-pattern debe ser una cadena').toBe('string');
    return new RegExp(source as string);
  }

  it('el patrón de Stylelint se deriva del mismo nombre', async () => {
    expect((await classPattern()).test(WIDGET_NAME)).toBe(true);
  });

  it('el patrón admite bloque y variante, y rechaza lo ajeno', async () => {
    const regex = await classPattern();

    expect(regex.test(`${WIDGET_NAME}__bloque`)).toBe(true);
    expect(regex.test(`${WIDGET_NAME}__bloque--variante`)).toBe(true);
    expect(regex.test('otra-clase')).toBe(false);
  });

  it('base.scss carga el módulo widget', () => {
    expect(read(BASE_SCSS)).toMatch(/@use\s+["']widget["']/);
  });

  it('base.scss escribe las clases con la variable, no a mano', async () => {
    expect(await literalClassSelectors(read(BASE_SCSS))).toEqual([]);
  });

  /**
   * El módulo `widget` tiene que alcanzar también a los parciales. Con
   * `additionalData` no ocurría: solo llegaba a los archivos que importa el
   * JS, y un parcial cargado con @use —la forma que este proyecto recomienda
   * para los parciales propios— fallaba con «Undefined variable».
   *
   * Se compila de verdad con el vite.config.ts real, porque el fallo era de
   * compilación y una comprobación sobre el texto del config no lo habría
   * visto.
   */
  it('el módulo widget también llega a un parcial cargado con @use', async () => {
    // Las fixtures van al temporal, no a src/. styleBoundaries.test.ts y
    // architecture.test.ts recorren src/ con readdir + stat, y vitest corre
    // los archivos de test en paralelo: crear y borrar ahí haría fallar a esos
    // dos de forma intermitente con ENOENT. El input del build es absoluto,
    // así que la entrada puede vivir fuera de la raíz del proyecto.
    const dir = mkdtempSync(path.join(tmpdir(), 'widget-partial-'));
    const outDir = path.join(dir, 'dist');
    const entry = path.join(dir, 'boundary-entry.scss');

    writeFileSync(
      path.join(dir, '_boundary-probe.scss'),
      '@use "widget" as *;\n\n.#{$widget-name}__sonda { display: block; }\n',
    );
    writeFileSync(entry, '@use "boundary-probe";\n');

    try {
      await build({
        root: ROOT,
        configFile: path.join(ROOT, 'vite.config.ts'),
        logLevel: 'silent',
        build: {
          outDir,
          emptyOutDir: true,
          cssCodeSplit: false,
          rollupOptions: { input: entry },
        },
      });

      const css = readdirSync(outDir, { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFileSync(path.join(outDir, file), 'utf8'))
        .join('');

      expect(css).toContain(`.${WIDGET_NAME}__sonda`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('literalClassSelectors', () => {
  it('no ve la interpolación como literal', async () => {
    expect(await literalClassSelectors('.#{$widget-name}__fila { display: flex; }')).toEqual([]);
  });

  it('sí ve una clase escrita a mano', async () => {
    expect(await literalClassSelectors('.mi-clase { display: block; }')).toEqual(['mi-clase']);
  });

  it('no confunde el valor de una declaración con una clase', async () => {
    expect(await literalClassSelectors('.#{$widget-name}::after { content: ".pdf"; }')).toEqual([]);
  });

  it('ve una clase literal pegada a una etiqueta', async () => {
    expect(await literalClassSelectors('div.acme-checkout { display: block; }')).toEqual(['acme-checkout']);
  });

  it('ignora los comentarios', async () => {
    expect(await literalClassSelectors('// .comentada\n/* .otra */\n.#{$widget-name} {}')).toEqual([]);
  });

  it('entra en los selectores anidados y en las at-rules', async () => {
    expect(await literalClassSelectors('@media (min-width: 0) { .dentro {} }')).toEqual(['dentro']);
    expect(await literalClassSelectors('.a, .b .c { color: red; }')).toEqual(['a', 'b', 'c']);
  });

  /** El caso del reporte anterior: un paquete llamado como la propia variable. */
  it('no falla cuando el paquete se llama widget-name', async () => {
    const scss = '@use "widget" as *;\n\n.#{$widget-name} { color: red; }\n';

    expect(await literalClassSelectors(scss)).toEqual([]);
  });
});
