# Rig de medición de performance

Este directorio y los `vite.config.*.ts` que se listan más abajo son el
instrumental con el que se midieron el baseline del template, los
contrafactuales de empaquetado y el plugin `lucideSubset`. No forma parte del
widget: no entra en `npm run build` ni en el bundle que se publica en Modyo.

Está versionado en `perf/baseline-v1.2.0`, que es la base de la cadena
`perf/baseline-v1.2.0 → fix/iife-output → feat/lucide-subset-plugin`. Así
ninguna rama de la cadena lo pierde al hacer `checkout` y cualquiera puede
reproducir una medición desde el repositorio.

Los reportes que produjo este rig viven en `~/Code/dynamic/_reports/`.

---

## Herramientas que hay que instalar aparte

Las tres herramientas de medición **no están en `devDependencies`** y se
instalan a mano cuando se va a medir:

```bash
npm i --no-save lighthouse@12.8.2 chrome-launcher@1.2.1 playwright@1.63.0
npx playwright install chromium
```

Razones para dejarlas fuera del `package.json`:

- Pesan mucho (Chromium son ~95 MB) y penalizarían el `npm ci` de todo el que
  clone el template para hacer un widget, que es la mayoría de los casos.
- El template es una plantilla que se copia para arrancar proyectos: cada
  dependencia declarada se hereda a todos los widgets que salgan de él.
- Nada del ciclo normal (`dev`, `build`, `test`, `lint`, `push`) las necesita.

`--no-save` deja `package.json` y `package-lock.json` intactos. Ojo: un
`npm ci` posterior las borra de `node_modules`, porque reconstruye el árbol
desde el lockfile. Si un script falla con
`ERR_MODULE_NOT_FOUND: Cannot find package 'lighthouse'`, es eso: hay que
reinstalarlas.

Alternativa que evita el problema: instalarlas en un directorio aparte y correr
los scripts desde ahí, pasando las URLs por argumento. Es lo que se hizo en la
medición de B1 + plugin, porque instalar un tarball de `@dynamic-framework/ui-react`
con `npm i --no-save` también reconstruye el árbol y se lleva estas tres.

`.perf/cf-toplevel.mjs` usa además `acorn`, que ya está en `node_modules` como
dependencia transitiva de Vite (8.16.0 al momento de escribir esto). No se
declara por lo mismo, pero es una dependencia no garantizada: si Vite deja de
arrastrarlo, hay que instalarlo con `--no-save`.

---

## Dónde caen los resultados

Todo lo que el rig genera está en `.gitignore`:

| Ruta | Contenido |
| --- | --- |
| `.perf/out/` | JSON de Lighthouse y de verificación, capturas PNG, logs del servidor |
| `.perf/probe/` | Fixtures de sondeos puntuales (configs de rollup/vite mínimas, entries de una sola línea) |
| `.perf/stats.json`, `.perf/results-*.json` | Salidas del visualizer y de `measure.mjs` |
| `dist-perf`, `dist-viz`, `dist-cf-*`, `dist-iife-*`, `dist-m-*` | Bundles de cada variante |

Los scripts asumen que `.perf/out/` existe; `cf-run.sh` lo crea.

---

## Entries de medición

Montan el mismo grafo de imports que `src/main.tsx`, con el contenedor resuelto
en tiempo de ejecución para poder montar N instancias independientes en una
misma página (como haría el widget manager de Modyo).

| Archivo | Para qué |
| --- | --- |
| `widget-entry.tsx` | El entry estándar. Añade marca de primer render por instancia y una sonda de identidad del módulo React, para contar copias en memoria. |
| `widget-entry-nocss.tsx` | Igual pero sin importar el CSS de Dynamic, para medir el escenario en que el sitio ya lo cargó. |
| `widget-entry-visual.tsx` | Monta `App` más un `DAlert` cerrable, para verificar en navegador que se pintan tanto los iconos del widget como los internos de Dynamic. No se usa para medir bytes. |
| `widget-entry-core-icons.tsx` | Monta los 27 iconos del núcleo más los 3 del widget por `DIcon`, y además cada componente de Dynamic que elige un icono del núcleo por su cuenta, en el estado que lo muestra. Incluye un icono propio registrado con `iconRegistry` y un nombre inexistente. No se usa para medir bytes. |

---

## Configuraciones de build del rig

Todas construyen un entry de `.perf/` en vez de `src/main.tsx`, y **ninguna
modifica `vite.config.ts`**. Se lanzan con `--config` y aceptan `--outDir` para
mandar cada variante a un directorio distinto.

| Config | Formato | Entry | Para qué |
| --- | --- | --- | --- |
| `vite.config.perf.ts` | `es` | `widget-entry.tsx` | Harness del baseline v1.2.0. |
| `vite.config.perf.iife.ts` | `iife` | `widget-entry.tsx` | El mismo harness con los dos cambios de `fix/iife-output` (`format: 'iife'` y `cssCodeSplit: false`). |
| `vite.config.visualizer.ts` | igual que el build real | `src/main.tsx` | Extiende `vite.config.ts` con `rollup-plugin-visualizer` (`template: 'raw-data'`) para desglosar el bundle por dependencia. Aparte a propósito, para que los tamaños y tiempos publicados salgan de `vite.config.ts` sin tocar. |
| `vite.config.cf.ts` | `es` | por entorno | `vite.config.perf.ts` parametrizada por variables de entorno, para construir la misma entrada en directorios distintos y con o sin el alias de `@dynamic-framework/ui-react`. La usan los contrafactuales. |
| `vite.config.m-base.ts` | `iife` | `src/main.tsx` | Copia congelada del `vite.config.ts` de `fix/iife-output`: es la referencia «sin plugin» del bundle real. |
| `vite.config.m-harness-base.ts` | `iife` | `widget-entry.tsx` | Harness sin el plugin. |
| `vite.config.m-harness-plugin.ts` | `iife` | `widget-entry.tsx` | Harness con `lucideSubset`. |
| `vite.config.m-visual-base.ts` | `iife` | `widget-entry-visual.tsx` | Verificación visual sin el plugin. |
| `vite.config.m-visual-plugin.ts` | `iife` | `widget-entry-visual.tsx` | Verificación visual con `lucideSubset`. |
| `vite.config.m-core-icons-base.ts` | `iife` | `widget-entry-core-icons.tsx` | Verificación de los iconos del núcleo sin el plugin. |
| `vite.config.m-core-icons-plugin.ts` | `iife` | `widget-entry-core-icons.tsx` | La misma, con `lucideSubset`. |

**Las dos configuraciones `*-plugin.ts` solo funcionan en
`feat/lucide-subset-plugin`**, porque importan `./.vite/plugins/lucideSubset`,
que existe solo en esa rama. En `perf/baseline-v1.2.0` y en `fix/iife-output`
están presentes pero fallan al construir. Se versionan igual, en la base de la
cadena, para que el rebase de la cadena no las duplique ni las pierda.

`vite.config.visualizer.ts` necesita `rollup-plugin-visualizer`, que sí está en
`devDependencies` desde `perf/baseline-v1.2.0`.

---

## Scripts

### Infraestructura

| Script | Qué hace |
| --- | --- |
| `server.mjs` | Servidor estático que comprime con brotli -q 11 o gzip -9 según `Accept-Encoding`, como haría un CDN. `node .perf/server.mjs <dir> <puerto>` |
| `make-pages.mjs` | Genera `perf-{1,3,5}.html` en `dist-perf/` más una página de control. Copia el bundle a un URL distinto por instancia (`widget-1.js`…), porque el module cache ejecuta un módulo una sola vez por URL: copias distintas dan grafos independientes. |
| `cf-pages.mjs` | La versión parametrizable de lo anterior: `node .perf/cf-pages.mjs <outDir> [--script=module\|classic] [--css=bundle\|cdn\|none] [--n=1,3]`. `--script=classic` es el modo de Modyo 9. |

### Medición

| Script | Qué mide |
| --- | --- |
| `measure.mjs` | Runtime con Playwright + CDP: LCP, CLS, INP real (con clic), TBT por long tasks, `ScriptDuration`/`TaskDuration`/`Layout`/`RecalcStyle`, heap tras forzar GC, tiempo hasta el primer render por instancia y número de copias de React. `node .perf/measure.mjs <baseUrl> <on\|off> <corridas>` |
| `lh.mjs` | Lighthouse móvil con throttling por defecto, escenarios 1/3/5. |
| `cf-lh.mjs` | Lo mismo pero con escenarios y corridas por argumento: `node .perf/cf-lh.mjs <baseUrl> <outJson> [escenarios=1,3] [corridas=3]` |
| `m-lh-interleaved.mjs` | Lighthouse sobre **varias variantes intercaladas**: cada ronda mide todas las variantes y repite. Así una deriva térmica o de carga afecta por igual a todas en vez de castigar a la que se mida al final. `node .perf/m-lh-interleaved.mjs <outJson> <etiqueta>=<url> [...]` |
| `m-lh-warmup.mjs` | Igual que el anterior, con dos añadidos: una **ronda de calentamiento** que se registra con `warmup: true` y no cuenta para la mediana, y el audit **`unused-javascript`** completo (bytes sin usar totales y por script). `node .perf/m-lh-warmup.mjs <outJson> <etiqueta>=<url> [...]` |
| `cf-sizes.mjs` | `raw` / `gzip -9` / `brotli -q 11` de `widget.js` y `widget.css`. Salida JSON. |
| `count-icons.mjs` | Cuenta los iconos de Lucide en un bundle. Se apoya en la factory de Lucide y tolera sus dos formas: con el nombre intacto y el nodo en una variable (`createLucideIcon("book",__iconNode$q)`) o minificada con el nodo en línea (`Mt("book",[["path",…)`). Exigir que el segundo argumento sea `[[` o `__iconNode` descarta falsos positivos como `addEventListener("click", handler)`. |

### Verificación funcional

| Script | Qué comprueba |
| --- | --- |
| `cf-check.mjs` | Carga `perf-N.html`, registra errores de consola y excepciones de página, comprueba que cada instancia monte (botón, iconos de `MyLink`) y guarda una captura. `node .perf/cf-check.mjs <baseUrl> <n> <out.png>` |
| `check-core-icons.mjs` | Sobre la página de `widget-entry-core-icons.tsx`: por cada nombre comprueba que exista un `<svg>` con la clase que Lucide compone, que el icono registrado se pinte como SVG en línea y que el inexistente caiga al fallback. Hace además una pasada de interacción (carga un archivo en `DBoxFile`, pulsa el ojo de `DInputPassword`) para los iconos que solo aparecen con estado. `node check-core-icons.mjs <url> <ruta/al/dist/esm/lucide-react.js> [outJson]` |

### Análisis de bundle

| Script | Qué analiza |
| --- | --- |
| `aggregate-bundle.mjs` | Agrupa el `stats.json` del visualizer por dependencia (react, react-dom, ui-react, lucide-react, framer-motion, …) con bytes y porcentaje. **Los absolutos de gzip/brotli por dependencia están sobreestimados**, porque el visualizer comprime cada módulo por separado: los porcentajes de la columna raw son la señal fiable. |
| `cf-packages.mjs` | Desglose por paquete npm de los módulos que aterrizan en `widget.js`. `node .perf/cf-packages.mjs <stats.json> [--json]` |
| `m-composition.mjs` | Desglose por paquete npm con raw, gzip y brotli, top N más una fila «resto», y **cadenas de retención**: para cada paquete que `src/` no importa directamente, el camino más corto por `importedBy` hasta el módulo de `src/` que lo arrastra. `node .perf/m-composition.mjs <stats.json> [chunk=main.js] [topN=15]` |
| `cf-retention.mjs` | Grafo de retención en `dist/index.esm.js` de ui-react: modela qué retiene Rollup cuando considera el módulo con efectos secundarios. |
| `cf-toplevel.mjs` | Imports top-level del bundle de ui-react, con `acorn`. |
| `cf-toplevel-scope.mjs` | Cuenta las declaraciones léxicas top-level (`const`/`let`/`class`) de un bundle. Es la medida que explica por qué el formato `es` rompe la segunda instancia servida con `<script>` clásico: en un script clásico todas las copias comparten el ámbito. `node .perf/cf-toplevel-scope.mjs <bundle.js>` |

### Resumen y utilidades

| Script | Qué hace |
| --- | --- |
| `summarize.mjs` | Medianas y tablas en Markdown a partir de los JSON de resultados. |
| `cf-table.mjs` | Tabla comparativa base contra intervención: `node .perf/cf-table.mjs <etiqueta> [<etiqueta> ...]` |
| `cf-patch.mjs` | Aplica y revierte los parches contrafactuales sobre `node_modules/@dynamic-framework/ui-react` por edición directa, sin tocar el repositorio `dynamic-ui`. Guarda copias prístinas `*.cf-orig` y regenera siempre desde ellas, así cada intervención parte del estado base. |
| `cf-run.sh` | Encadena una variante completa: páginas, servidor, precalentado de la compresión, tamaños, verificación y Lighthouse. `.perf/cf-run.sh <dir> <etiqueta> <puerto> [--script=…] [--css=…]` |

El precalentado de `cf-run.sh` no es decorativo: el servidor comprime cada
archivo en el primer request, y brotli -q 11 sobre 2 MB tarda segundos. Sin él,
la primera corrida de Lighthouse mide un servidor frío y sale fuera de rango.

---

## Cómo se lanza cada medición

Antes de todo: `npm ci`, y las tres herramientas de medición instaladas como se
indica arriba.

### Tamaño del bundle real

```bash
npm run build
node -e "const z=require('zlib'),f=require('fs');for(const n of ['main.js','main.css']){const b=f.readFileSync('dist/'+n);console.log(n,b.length,z.gzipSync(b,{level:9}).length,z.brotliCompressSync(b,{params:{[z.constants.BROTLI_PARAM_QUALITY]:11}}).length)}"
node .perf/count-icons.mjs dist/main.js
```

### Desglose del bundle por dependencia

```bash
mkdir -p .perf
npx vite build --config vite.config.visualizer.ts --outDir dist-viz
node .perf/aggregate-bundle.mjs
```

### Runtime del baseline (formato `es`)

```bash
npx vite build --config vite.config.perf.ts
node .perf/make-pages.mjs
node .perf/server.mjs "$PWD/dist-perf" 4319 &
node .perf/measure.mjs http://127.0.0.1:4319 off 3   # sin throttling
node .perf/measure.mjs http://127.0.0.1:4319 on  3   # 4x CPU + Slow 4G
node .perf/lh.mjs
node .perf/summarize.mjs
```

### Runtime en IIFE, servido como script clásico

```bash
npx vite build --config vite.config.perf.iife.ts
node .perf/cf-pages.mjs dist-iife-perf --script=classic --n=1,3
.perf/cf-run.sh dist-iife-perf iife-classic 4331 --script=classic
node .perf/cf-table.mjs iife-classic
```

### Con y sin `lucideSubset`, intercalado

Requiere estar en `feat/lucide-subset-plugin`.

```bash
npx vite build --config vite.config.m-harness-base.ts   --outDir dist-m-harness-base
npx vite build --config vite.config.m-harness-plugin.ts --outDir dist-m-harness-plugin
for d in dist-m-harness-base dist-m-harness-plugin; do
  node .perf/cf-pages.mjs $d --script=classic --n=1,3
done
node .perf/server.mjs "$PWD/dist-m-harness-base"   4401 &
node .perf/server.mjs "$PWD/dist-m-harness-plugin" 4402 &
node .perf/m-lh-interleaved.mjs .perf/out/m-lh.json \
  sin-plugin=http://127.0.0.1:4401 con-plugin=http://127.0.0.1:4402
```

### Verificación visual de iconos

```bash
npx vite build --config vite.config.m-visual-plugin.ts --outDir dist-m-visual-plugin
node .perf/cf-pages.mjs dist-m-visual-plugin --script=classic --n=1
node .perf/server.mjs "$PWD/dist-m-visual-plugin" 4411 &
node .perf/cf-check.mjs http://127.0.0.1:4411 1 .perf/out/visual-n1.png
```

Se comprueba que haya 3 `<svg>` en las tarjetas de `MyLink` y 2 en el `DAlert`,
y **cero** fallbacks `<i class="d-icon bi bi-…">`. Ese `<i>` es el modo de fallo
de Dynamic cuando el nombre del icono no está en el bundle: no lanza error, no
avisa, y simplemente no se pinta nada.

### Comparar dos versiones de `@dynamic-framework/ui-react`

`node_modules` solo admite una versión a la vez, así que se construye por fases
y se miden después todos los bundles ya construidos:

```bash
npx vite build --config vite.config.m-harness-plugin.ts --outDir dist-m-hA-plugin
npm i --no-save /ruta/al/tarball.tgz
npm i --no-save lighthouse@12.8.2 chrome-launcher@1.2.1 playwright@1.63.0  # el paso anterior las borra
npx vite build --config vite.config.m-harness-plugin.ts --outDir dist-m-hB-plugin
# ... y ahora Lighthouse intercalado sobre los dos directorios
npm ci   # restaura la versión del lockfile
```

---

## Cosas que conviene recordar

- Las mediciones son **relativas al entorno**. Los números publicados salieron
  de un Apple M4 Pro con throttling emulado; sirven para comparar variantes
  entre sí, no como predicción de campo.
- **Mediana de 3 corridas**, siempre. Y si se comparan variantes, intercaladas.
- El rig mide el widget **aislado de Modyo**: sin sustitución de Liquid, sin
  widget manager, sin el CSS ni el JS del sitio anfitrión. En un build de
  producción servido fuera de Modyo, `{{site.language}}` queda sin resolver y
  i18next cae a su idioma por defecto.
- `dist-*` y `.perf/out` no se limpian solos. Conviene borrarlos entre tandas
  para no medir un directorio viejo por equivocación.
- **`server.mjs` cachea el contenido de cada archivo en memoria** la primera vez
  que se pide, para no recomprimir con brotli -q 11 en cada request. Si
  reconstruyes un bundle sin reiniciar el servidor, seguirás midiendo el
  anterior. Reinicia el servidor después de cada build.
- El aviso por icono desconocido de Dynamic vive detrás de
  `process.env.NODE_ENV !== 'production'`, así que **no existe en el build**:
  solo se observa en el dev server. `.perf/dev-icons.html` sirve
  `widget-entry-core-icons.tsx` desde `vite dev` justo para eso:

  ```bash
  npx vite --port 5199
  # abrir http://127.0.0.1:5199/.perf/dev-icons.html
  ```
