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
import { readFileSync } from 'node:fs';
import path from 'node:path';

import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

import { normalizeWidgetName, readPackageName, resolveWidgetName } from '../../.vite/widgetName';

const ROOT = path.resolve(__dirname, '../..');

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), 'utf8');
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

  it('la clase de base.scss concuerda con el patrón', async () => {
    const regex = await classPattern();
    const classes = [...read(BASE_SCSS).matchAll(/^\.([a-z0-9_-]+)/gm)].map(([, name]) => name);

    expect(classes.length).toBeGreaterThan(0);
    for (const className of classes) {
      expect(regex.test(className), `.${className} no sigue el patrón`).toBe(true);
    }
  });
});
