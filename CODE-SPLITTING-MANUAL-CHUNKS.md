# Code splitting en Modyo: por qué `manualChunks` es obligatorio

> **Resumen:** si algún chunk lazy necesita código que quedó en `main.js`, ese chunk termina
> importando el entry por una URL que **solo es estable cuando el widget está publicado**. En el
> preview de Modyo esa URL devuelve un archivo distinto en cada request, así que `main.js` se
> ejecuta varias veces, hay varias copias de React en la página y el widget revienta con
> `Minified React error #321` y `removeChild`. La solución es sacar todo el código compartido del
> entry con `build.rollupOptions.output.manualChunks`.

## Síntomas

El widget **funciona publicado** pero **falla en el preview** de la página editable. En consola:

- El `console.log` del entry (por ejemplo el de la versión de React) aparece **2, 3 o más veces**.
- `Error: Minified React error #321` — invalid hook call.
- `NotFoundError: Failed to execute 'removeChild' on 'Node'`.
- En los stack traces aparecen **varios hashes distintos** para el mismo entry:

```
at ut.useState (.../widget_manager/<wid>/2ec8e27….js:1:9496)     ← un React
at Kr         (.../widget_manager/<wid>/f8b5432….js:16:48073)    ← otro React
at c8         (.../widget_manager/<wid>/721ddf3….js:17:40498)    ← y otro más
```

Si ves ese patrón —el mismo widget cargado desde tres hashes diferentes— es exactamente este
problema.

## Cómo sirve Modyo un widget con chunks

Modyo **renombra y reubica el entry** en cada build. Para un widget publicado:

```
https://<site>/widget_manager/<wid>/696fd65cd444….js          ← main.js renombrado al content hash
https://<site>/widget_manager/<wid>/696fd65cd444…/Primary.…chunk.js   ← los chunks, en la carpeta hermana
```

El widget manager expone la carpeta de recursos en un global:

```js
window['resourceBasePath-<wid>'] = 'https://<site>/widget_manager/<wid>/696fd65cd444…/';
```

El plugin `vite-plugin-transform-dynamic-imports` usa ese global para reescribir los imports
dinámicos y las URLs de preload, de modo que los chunks y su CSS se resuelvan dentro de esa
carpeta en lugar de la raíz del dominio.

## La causa raíz

Un `import()` dinámico se puede reescribir en runtime, porque su especificador es una expresión.
Un **import estático no**: el especificador tiene que ser un string literal, así que no puede
referirse a `resourceBasePath`.

Entonces, cuando un chunk lazy necesita algo que vive en el entry —React, `jsx-runtime`, tu
librería de UI— Rollup emite:

```js
// Primary.…chunk.js
import { r as n, j as e, _ as o } from "./main.js";
```

y el plugin no tiene más opción que apuntarlo a la URL canónica del widget:

```js
import { r as n, j as e, _ as o } from "{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js";
```

Aquí está el problema: **`{{widget.version}}` renderiza al content hash del build**.

| | `{{widget.version}}` | Resultado |
|---|---|---|
| **Publicado** | congelado, el mismo para todos los requests | Los N chunks importan la **misma** URL → el module map del navegador deduplica → **una** instancia del entry ✅ |
| **Preview / draft** | se vuelve a renderizar en cada request | Cada chunk se sirve por Liquid por separado, así que **cada uno recibe un hash distinto** → N URLs distintas → **N ejecuciones del entry** ❌ |

El module map del navegador indexa los módulos **por URL**. Tres URLs distintas son tres módulos
distintos, aunque el contenido sea idéntico. Por eso `main.js` se evalúa una vez por chunk, y con
él React entero.

### De ahí salen los dos errores

- **React error #321** — el hook se ejecuta contra una copia de React distinta a la del renderer
  que montó el árbol. Se ve literal en el stack: `useState` en `2ec8e27….js` y el reconciler en
  `f8b5432….js`.
- **`removeChild: The node to be removed is not a child of this node`** — dos renderers
  compitiendo por los mismos nodos del DOM.

## La solución: `manualChunks`

La regla es simple: **ningún chunk lazy debe importar el entry**. Todo lo que un chunk pueda
llegar a necesitar tiene que vivir en otro chunk, dentro de la carpeta de recursos, donde se
resuelve con imports relativos estables.

```ts
// vite.config.ts
build: {
  chunkSizeWarningLimit: 2000,
  assetsDir: '',
  rollupOptions: {
    output: {
      format: 'es',
      entryFileNames: 'main.js',
      chunkFileNames: '[name].[hash].chunk.js',

      manualChunks(id) {
        if (id.includes('@dynamic-framework/ui-react')) {
          return 'dynamic-ui-react';
        }
        if (id.includes('/node_modules/') || id.includes('vite/preload-helper')) {
          return 'vendor';
        }
      },
    },
  },
},
```

Dos buckets bastan: **todo** `node_modules` va a `vendor` y la librería de UI se separa en
`dynamic-ui-react` porque es la que más cambia entre versiones del template. No hace falta un
chunk por paquete (`vendor-axios`, `vendor-react`, …): lo que importa no es cuántos chunks hay,
sino que **ninguna** dependencia compartida quede en el entry. El orden de los `if` sí importa —
la condición de `ui-react` va primero porque también matchea `/node_modules/`.

Con eso, el grafo queda así:

```
main.js                          await import(resourceBasePath + "vendor.….chunk.js")
                                 await import(resourceBasePath + "dynamic-ui-react.….chunk.js")
ImportedComponent.…chunk.js      import … from "./vendor.….chunk.js"
                                 import … from "./dynamic-ui-react.….chunk.js"
dynamic-ui-react.…chunk.js       import … from "./vendor.….chunk.js"
```

Todo relativo, todo dentro de `resourceBasePath`, **una sola copia de React**. Y funciona aunque
en preview el hash de la carpeta y el del entry no coincidan, porque nadie depende ya de la URL
canónica.

Dos detalles de cómo lo consigue el plugin:

- El import estático del vendor en `main.js` se reescribe a un `await import(…)` de nivel superior
  (los especificadores estáticos no aceptan expresiones). Eso **requiere `format: 'es'`**; con
  `cjs`/`iife` el plugin salta la transformación y avisa.
- Incluir `vite/preload-helper` en un vendor chunk es intencional: mantiene el helper de preload
  junto al resto del código compartido en vez de duplicarlo.

### Nota: si pruebas con paquetes locales (yalc, `npm link`, workspaces)

Con dependencias normales de npm esto no aplica: `id.includes('node_modules/@dynamic-framework/ui-react')`
funciona igual de bien. Pero si en algún momento enlazas un paquete en local para probar, conviene
saberlo.

`id` es un **path resuelto (realpath)**, así que para un paquete enlazado apunta al destino del
symlink y **no contiene el segmento `node_modules/`**:

```
/Users/…/mi-widget/.yalc/@dynamic-framework/ui-react/dist/esm/components/DButton.js
```

Un matcher escrito como `node_modules/<paquete>` deja de acertar, el paquete se queda en el entry
sin ningún error visible, y el widget vuelve a fallar solo en preview. Por eso la primera
condición matchea **por nombre de paquete** (`'@dynamic-framework/ui-react'`, sin el segmento
`node_modules/`) y así cubre los dos casos.

El fallback sí depende de `/node_modules/`, así que si enlazas paquetes en local añádele `/.yalc/`:

```ts
if (id.includes('/node_modules/') || id.includes('/.yalc/') || id.includes('vite/preload-helper')) {
  return 'vendor';
}
```

## Cómo detectarlo antes de subir

**1. El warning del plugin.** Desde la versión que incluye el chequeo, `npm run build` avisa:

```
[plugin transform-dynamic-imports] transform-dynamic-imports: 4 chunk(s) import the entry and
were rewritten to the canonical widget_manager URL (ImportedComponent.…chunk.js, Primary.…chunk.js,
Secondary.…chunk.js, Third.…chunk.js). That URL only resolves to a single, stable file once the
widget is published: in Modyo preview/draft mode each chunk gets its own copy of the entry,
producing multiple React instances (React error #321, removeChild NotFoundError). …
```

**2. Grep sobre el build.** El chequeo definitivo, y sirve en CI:

```bash
npm run build
grep -l widget_manager dist/*.chunk.js && echo "❌ hay chunks importando el entry" || echo "✅ ok"
```

No debe salir **ningún** archivo. Si sale alguno, mira qué símbolos importa para saber qué
paquete falta mover a un vendor chunk:

```bash
grep -o 'import{[^}]*}from *"{{site.url}}[^"]*"' dist/*.chunk.js
```

**3. En el navegador.** Cuenta los `console.log` del entry en el preview: tiene que aparecer
**una sola vez**. En la pestaña Network, todos los `.chunk.js` deben colgar de la misma carpeta
`<hash>/`.

## Verificación de referencia

Así se ve un build sano de este template:

```
dist/main.js                             14.04 kB   ← solo el código del widget
dist/vendor.….chunk.js                  409.76 kB   ← react, react-dom, i18next, axios, …
dist/dynamic-ui-react.….chunk.js         13.56 kB   ← solo los componentes usados
dist/ImportedComponent.….chunk.js         0.22 kB
```

Antes de aplicar `manualChunks`, `main.js` pesaba más de 400 kB y los chunks importaban la URL
canónica. El log del build lo confirma: `transform-dynamic-imports` reescribe **3 import(s) in
main.js** (los dos vendor + el lazy) y **ninguno** en los chunks.

## Por qué esto no se puede arreglar dentro del plugin

Se evaluó derivar la URL del entry desde `resourceBasePath`: en publicado, `<version>.js` y
`<version>/` son hermanos, así que `entryUrl = resourceBasePath.replace(/\/$/, '') + '.js'`.

No sirve. En preview el hash de la carpeta de recursos y el del entry que realmente ejecutó el
widget manager **no coinciden** (se observó `26c6c97…` para la carpeta y `721ddf3…` para el
entry), así que esa derivación seguiría produciendo una segunda instancia.

La única garantía real es que ningún chunk importe el entry, y eso lo decide el `manualChunks` del
proyecto. El plugin solo puede avisar en build time.

## Checklist

- [ ] `manualChunks` definido en `vite.config.ts`.
- [ ] Si usas paquetes enlazados en local, los matchers van por **nombre de paquete**, no por el segmento `node_modules/`.
- [ ] `format: 'es'` en la salida de Rollup.
- [ ] `npm run build` no emite el warning de *chunk(s) import the entry*.
- [ ] `grep -l widget_manager dist/*.chunk.js` no devuelve nada.
- [ ] Probado **en preview**, no solo publicado: el log del entry aparece una sola vez.

## Referencias

- Plugin: [vite-plugin-transform-dynamic-imports](https://github.com/dynamic-framework/vite-plugin-transform-dynamic-imports)
- [React error #321](https://react.dev/errors/321)
- [Vite — chunking strategy](https://vite.dev/guide/build.html#chunking-strategy)
