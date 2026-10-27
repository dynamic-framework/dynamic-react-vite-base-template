import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * El nombre de montaje del widget: el valor de `data-widget`, del `id` del
 * contenedor y el prefijo de las clases propias.
 *
 * Se deriva de `name` en package.json para que exista en un solo sitio. Antes
 * vivía repetido en src/app/main.tsx, index.html, src/styles/base.scss y la
 * configuración de Stylelint, y nada comprobaba que coincidieran: dos widgets
 * creados del template sin renombrar montaban los dos en `widgetName`, el
 * primer bundle ocupaba también los contenedores del otro y el segundo no
 * aparecía, sin un solo error en consola.
 *
 * tests/boundaries/widgetName.test.ts comprueba que los cuatro sitios siguen
 * de acuerdo.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Pasa el nombre de un paquete npm a un identificador válido a la vez como
 * valor de `data-widget`, como `id` y como clase CSS.
 *
 * El scope se pliega en lugar de descartarse (`@acme/checkout` →
 * `acme-checkout`): quedarse con el último segmento haría chocar a dos
 * organizaciones que publican el mismo nombre.
 *
 * LÍMITE CONOCIDO: la transformación tiene pérdida. `-`, `.`, `_` y `/`
 * colapsan todos en `-`, así que un puñado de pares caen en el mismo valor
 * (`@acme/checkout` y `acme-checkout`; `@acme/checkout-cart` y
 * `@acme-checkout/cart`; `@a-b/c` y `@a.b/c`). Si dos widgets así comparten
 * página, vuelven a ocuparse los contenedores entre sí.
 *
 * Se acepta a conciencia. Evitarlo exigiría un sufijo hash o un escape que
 * duplique los guiones —lo segundo chocaría con el `--variante` del patrón
 * BEM—, y las dos opciones vuelven ilegible el identificador de TODOS los
 * widgets para cubrir un naming rebuscado. Además el fallo ya no es silencioso:
 * el widget que se queda sin contenedor avisa por consola nombrándose, también
 * en producción (ver src/app/main.tsx). Los pares están en
 * tests/boundaries/widgetName.test.ts para que el límite quede registrado.
 */
export function normalizeWidgetName(packageName: string): string {
  const normalized = packageName
    .replace(/^@/, '')
    // camelCase y PascalCase se separan antes de bajar a minúsculas, para que
    // `myWidget` quede `my-widget` y no `mywidget`.
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (normalized === '') {
    throw new Error(
      `El nombre "${packageName}" de package.json no deja ningún carácter válido `
      + 'para el nombre de montaje: usa letras y números.',
    );
  }

  // Una clase CSS no puede empezar por un dígito.
  return /^\d/.test(normalized) ? `w-${normalized}` : normalized;
}

/** Lee `name` de package.json. */
export function readPackageName(root: string = ROOT): string {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { name?: unknown };

  if (typeof pkg.name !== 'string' || pkg.name === '') {
    throw new Error('package.json debe declarar un "name" para derivar el nombre de montaje.');
  }

  return pkg.name;
}

/**
 * Lee el paquete de origen en `template` de widget.manifest.json, que tiene la
 * forma `paquete@versión`. En el propio template coincide con el `name` de
 * package.json; en un widget creado a partir de él, no.
 */
export function readTemplatePackageName(root: string = ROOT): string {
  const manifest = JSON.parse(
    readFileSync(path.join(root, 'widget.manifest.json'), 'utf8'),
  ) as { template?: unknown };

  if (typeof manifest.template !== 'string') {
    throw new Error('widget.manifest.json debe declarar "template" con la forma paquete@versión.');
  }

  // Se parte por el último `@` para admitir paquetes con scope.
  const at = manifest.template.lastIndexOf('@');
  return at > 0 ? manifest.template.slice(0, at) : manifest.template;
}

/** El nombre de montaje de este proyecto. */
export function resolveWidgetName(root: string = ROOT): string {
  return normalizeWidgetName(readPackageName(root));
}
