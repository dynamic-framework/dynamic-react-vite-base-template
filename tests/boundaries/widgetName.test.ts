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

/** Sustituye los comentarios por espacios, conservando las posiciones. */
function stripComments(scss: string): string {
  return scss
    .replace(/\/\*[\s\S]*?\*\//g, (text) => text.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (text) => text.replace(/./g, ' '));
}

/**
 * Selectores de clase escritos como literal, es decir sin interpolación.
 *
 * Mira solo los selectores y descarta los comentarios: buscar el nombre
 * derivado como subcadena daba falsos positivos: un paquete llamado
 * `widget-name` hace que `.#{$widget-name}` contenga su propio nombre, y uno
 * llamado `widget` aparece además dentro de `@use "widget"` y de cualquier
 * comentario que lo mencione.
 */
export function literalClassSelectors(scss: string): string[] {
  return [...stripComments(scss).matchAll(/(?<![\w#{])\.([a-zA-Z_][\w-]*)/g)]
    .map(([, name]) => name);
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
  const BASE_SCSS = 'src/styles/base.scss';

  /**
   * Se resuelve con la API de Stylelint en lugar de importar el archivo de
   * configuración, para comprobar el patrón que Stylelint aplica de verdad.
   */
  async function classPattern(): Promise<RegExp> {
    const config = await stylelint.resolveConfig(path.join(ROOT, BASE_SCSS));
    const rule = config?.rules?.['selector-class-pattern'];
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

  it('base.scss escribe las clases con la variable, no a mano', () => {
    expect(literalClassSelectors(read(BASE_SCSS))).toEqual([]);
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
    const dir = mkdtempSync(path.join(tmpdir(), 'widget-partial-'));
    const outDir = path.join(dir, 'dist');
    const stylesDir = path.join(ROOT, 'src', 'styles');
    const partial = path.join(stylesDir, '_boundary-probe.scss');
    const entry = path.join(stylesDir, 'boundary-entry.scss');

    writeFileSync(partial, '@use "widget" as *;\n\n.#{$widget-name}__sonda { display: block; }\n');
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
      rmSync(partial, { force: true });
      rmSync(entry, { force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('literalClassSelectors', () => {
  it('no ve la interpolación como literal', () => {
    expect(literalClassSelectors('.#{$widget-name}__fila { display: flex; }')).toEqual([]);
  });

  it('sí ve una clase escrita a mano', () => {
    expect(literalClassSelectors('.mi-clase { display: block; }')).toEqual(['mi-clase']);
  });

  it('ignora los comentarios', () => {
    expect(literalClassSelectors('// usa .#{$widget-name}\n/* y no .otra */\n')).toEqual([]);
  });

  /** El caso del reporte: un paquete llamado como la propia variable. */
  it('no falla cuando el paquete se llama widget-name', () => {
    const scss = '@use "widget" as *;\n\n.#{$widget-name} { color: red; }\n';

    expect(literalClassSelectors(scss)).toEqual([]);
  });

  it('tampoco cuando el paquete se llama widget', () => {
    expect(literalClassSelectors('@use "widget" as *;\n.#{$widget-name} {}')).toEqual([]);
  });
});
