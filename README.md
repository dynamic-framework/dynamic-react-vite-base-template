# Dynamic React Vite Base Template

Template base para crear widgets con Dynamic Framework usando Vite.

## Stack

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 19.x | UI |
| TypeScript | 5.9.x | Tipado |
| Vite | 7.x | Build y servidor de desarrollo |
| Dynamic UI (`@dynamic-framework/ui-react`) | 2.12.1 | Componentes |
| TanStack Query | 5.x | Datos remotos y caché |
| Axios | 1.x | Cliente HTTP |
| i18next / react-i18next | 25.x / 16.x | Internacionalización |
| liquidjs | 10.x | Variables Liquid en desarrollo |
| Vitest | 5.x | Tests |

## Requisitos

- Node.js 22.13+, 24.x o 26+ (`engines` en `package.json`; `.nvmrc` fija la 22).
  Las líneas impares (23.x, 25.x) no están soportadas: son non-LTS, varias
  dependencias de desarrollo (`eslint-plugin-jsonc`, `jsdom`) excluyen la 23.x de su `engines`
  y `vitest` excluye la 23.x y la 25.x.

## Inicio Rápido

Un widget nuevo parte de la versión publicada del template, con una historia de git propia:

```bash
# Clonar la versión 1.4.1 del template
git clone --depth 1 --branch v1.4.1 https://github.com/dynamic-framework/dynamic-react-vite-base-template.git mi-widget
cd mi-widget

# Empezar una historia propia
rm -rf .git
git init

# Instalar dependencias e iniciar desarrollo
npm ci
npm run dev
```

> El botón **Use this template** de GitHub copia la rama por defecto del repositorio, no una versión publicada. Para partir de una versión concreta, usa el `git clone --branch v1.4.1` de arriba.

Después, en el widget nuevo:

1. Cambia `name` en `package.json` y en `widget.manifest.json` (deben coincidir) y fija la `version` del widget en los dos.
2. Cambia el nombre de montaje `widgetName`: la constante `WIDGET_NAME` de `src/app/main.tsx` y el `data-widget` del contenedor de `index.html` (ver [Punto de montaje](#punto-de-montaje)).
3. Cambia la clase `widget-name` en `index.html`, `src/styles/base.scss` y `selector-class-pattern` de `.stylelintrc` (ver [Estilos](#estilos-qué-lleva-el-widget-y-qué-pone-el-sitio)).
4. Copia `.modyo.example` a `.modyo` y complétalo (ver [Configuración de Modyo](#configuración-de-modyo)).

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` (o `npm start`) | Inicia el servidor de desarrollo |
| `npm run build` | Compila para producción en `dist/` |
| `npm run preview` | Sirve `dist/` en local |
| `npm run lint` | Ejecuta ESLint |
| `npm run stylelint` | Ejecuta Stylelint para CSS/SCSS |
| `npm run test` | Ejecuta los tests con Vitest |
| `npm run test:watch` | Ejecuta los tests en modo watch |
| `npm run push` | Build + push a Modyo |
| `npm run push:publish` | Build + push + publish a Modyo |
| `npm run push:debug` | Build + push con logging de diagnóstico |

## Arquitectura

El código se organiza por dominio: cada dominio es una feature con todas sus capas, y lo que no es de ningún dominio vive en `shared/`.

```
├── src/
│   ├── app/                 # Arranque: main.tsx, App.tsx, montaje y providers
│   ├── config/              # widgetConfig, i18n y variables Liquid (liquid.json)
│   ├── pages/               # Páginas: componen features
│   ├── features/
│   │   └── entities/        # Una carpeta por dominio
│   │       ├── index.ts     # Única puerta de la feature
│   │       ├── api/         # Red, dto (*.dto.ts) y mocks (*.mock.ts)
│   │       ├── model/       # Tipos de dominio y funciones puras
│   │       ├── service/     # (Opcional) Orquesta api/ y model/
│   │       ├── hooks/       # TanStack Query sobre api/
│   │       └── ui/          # Componentes de la feature
│   ├── shared/              # Transversal, sin dominio
│   │   ├── http/            # Cliente HTTP
│   │   ├── ui/              # Estados (carga, vacío, error) y ErrorBoundary
│   │   ├── hooks/           # Hooks genéricos
│   │   └── lib/             # Utilidades (liquidParser, errorHandler)
│   ├── locales/             # Traducciones (es.json, en.json)
│   └── styles/              # SCSS propio del widget
├── tests/                   # Espejo de src/, más boundaries/ y vite-plugins/
├── .vite/plugins/           # Plugins de build: escapeLiquidInStrings y lucideSubset
├── docs/recipes/            # Recetas de módulos opcionales
├── index.html               # Página de desarrollo
├── widget.manifest.json     # Manifiesto del widget
├── vite.config.ts           # Configuración de Vite y Vitest
└── eslint.config.js         # Linting y grafo de importaciones
```

Todo lo que está bajo `src/` se importa con el alias `@/` (por ejemplo, `@/shared/ui`). Dentro de una misma feature se usan rutas relativas entre sus capas.

### Grafo de importaciones

```
app ──▶ pages ──▶ features/<x>/index.ts
 │        │              │
 └────────┴──────┬───────┘
                 ▼
          shared ◀──▶ config      (sin importar features, app ni pages)

Dentro de una feature:  ui ──▶ hooks ──▶ (service) ──▶ api
                         └────────┴──────────┴─────────▶ model
```

- `app/` y `pages/` usan una feature solo por su `index.ts` (`@/features/<nombre>`), nunca sus carpetas internas. `pages/` no importa `app/`.
- En `src/` las importaciones son estáticas: `import()` no se usa, porque el build es un único `main.js` que lo incrusta igual y saltaría el grafo. La excepción es `src/app/modyo-preview-entry.ts`, que carga el servidor de desarrollo.
- Todas las áreas pueden usar `shared/` y `config/`. Entre ellas, `config/` usa `shared/lib/` (por ejemplo, `liquidParser`) y `shared/http/` lee `config/`; ninguna de las dos importa features, `app/` ni `pages/`.
- La red (`shared/http/`) solo se usa desde la capa `api/` de una feature. El `index.ts` de una feature expone `hooks/`, `model/` y `ui/`; de `api/` y `service/`, solo tipos, y no reexporta el cliente HTTP.
- Una feature no entra en otra por dentro: la usa por su `index.ts`. Tampoco importa `app/` ni `pages/`.
- Dentro de la feature, `ui/` usa `hooks/`; `hooks/` usa `api/` (o `service/`, si existe); `model/` es puro (sin React, red, configuración ni UI) y de las demás capas solo recibe `import type`. `ui/` puede importar tipos de `api/` con `import type`. Entre capas, las rutas relativas son directas (`../hooks/useX`), sin `..` intermedios.
- Dentro de una feature, sus capas se importan entre sí por ruta relativa, nunca por su propio `index.ts` (`..`, `../index` o `@/features/<propia>`).
- Los mocks (`*.mock.ts`) solo los importa `api/`, que decide con `USE_MOCKS` (`vars.use-mocks`) si devuelve datos de prueba o llama a la red.

ESLint aplica el grafo (`@typescript-eslint/no-restricted-imports`, en `eslint.config.js`) y cada error dice qué importar en su lugar. `tests/boundaries/architecture.test.ts` comprueba que cada regla sigue aplicando a la ruta de su capa y que todo archivo de `src/` cae bajo alguna; si se renombra una carpeta sin actualizar `eslint.config.js`, el test falla.

ESLint también exige que el texto visible de los componentes salga de `t('...')`, con sus llaves en `src/locales/*.json` (no se admite texto literal en JSX), y que las llaves de `src/config/*.json` vayan en orden alfabético (`npx eslint --fix` las reordena).

### Agregar una feature

`src/features/entities/` es la feature de referencia: tiene cada capa con un ejemplo mínimo y un test por capa en `tests/features/entities/`. Una feature nueva parte de una copia suya.

```
src/features/entities/
├── index.ts                   # Única puerta: hooks, tipos de model/ y ui/
├── api/
│   ├── entityApi.ts           # Una función por endpoint, con AbortSignal y USE_MOCKS
│   ├── entity.dto.ts          # Forma de la respuesta de la API
│   └── entity.mock.ts         # Datos de prueba con la forma del dto
├── model/
│   ├── entity.ts              # Tipos de dominio
│   └── entity.mapper.ts       # dto → dominio, función pura
├── hooks/
│   └── useEntities.ts         # Llaves de la feature y hooks de TanStack Query
└── ui/
    ├── EntityListScreen.tsx   # Bloque con estados de carga, vacío y error
    └── EntityCreateModal.tsx  # Modal que se abre como portal
```

1. **Copia** la feature y sus tests con el nombre del dominio en kebab-case:

   ```bash
   cp -R src/features/entities src/features/<nombre>
   cp -R tests/features/entities tests/features/<nombre>
   ```

2. **Renombra** archivos e identificadores en las dos copias, respetando mayúsculas: `Entities` → `<Dominios>`, `Entity` → `<Dominio>`, `entities` → `<dominios>`, `entity` → `<dominio>`. Eso cubre `entityApi.ts`, `entity.dto.ts`, `useEntities`, `entityKeys` (su primera llave, `['entities']`, debe ser única en el widget) y el nombre del portal (`'entity-create'`). En los tests, las rutas `@/features/entities/...` pasan a `@/features/<nombre>/...`.
3. **Ajusta el dominio:** el endpoint en `api/`, los campos del dto y del tipo de dominio, y el mapper que los une.
4. **Textos:** copia el bloque `entities` de `src/locales/es.json` y `src/locales/en.json` con el nombre nuevo; el componente usa `t('<dominios>.list.title')` y similares.
5. **Usa la feature** desde `src/pages/` con `import { ... } from '@/features/<nombre>'`.
6. **Registra el modal** cuando el widget lo use. El template arranca con `availablePortals` vacío en el `DContextProvider` de `src/app/main.tsx`; el modal de la feature se registra ahí con su nombre de portal. Con la feature de referencia:

   ```tsx
   import { EntityCreateModal, type EntityPortals } from '@/features/entities';

   <DContextProvider<EntityPortals> availablePortals={{ 'entity-create': EntityCreateModal }}>
   ```

   Registrarlo incluye `DModal` y su animación (`framer-motion`) en `main.js`, aunque la página no llegue a abrirlo, así que no lo registres si el widget no lo abre. Si una pantalla llama a `openPortal` con un nombre sin registrar, Dynamic lanza un error.
7. Ejecuta `npm run lint`, `npm test` y `npm run build`.

Si el dominio es pequeño, borra lo que no use:

- **Solo lectura:** quita `createEntity` de `api/`, `useCreateEntity` de `hooks/`, `CreateEntityData` de `model/`, `EntityCreateModal.tsx` (y su registro en `main.tsx`, si lo hiciste), el botón de crear de `EntityListScreen.tsx` y los tests de creación.
- **Sin filtros:** quita `EntityFilters`, el parámetro `filters` de `api/` y de `hooks/` y la búsqueda de `EntityListScreen.tsx`.
- **Sin pantalla propia:** si otra feature o una página pinta los datos, borra `ui/` y deja que `index.ts` exporte solo los hooks y los tipos.
- **API sin transformar:** si la respuesta ya tiene la forma del dominio, el mapper puede reducirse a devolver el dto, pero mantenlo: es el único punto que cambia si la API cambia.

`service/` no viene en la referencia. Créalo cuando una operación combine varios endpoints o aplique reglas que no dependen de React; los hooks lo usan en lugar de `api/`. Si solo reenviaría llamadas a `api/`, sobra.

### Quitar una feature

1. Borra `src/features/<nombre>/` y `tests/features/<nombre>/`.
2. Quita sus importaciones de `src/pages/` (y de `src/app/main.tsx` si registró portales).
3. Quita sus llaves de `src/locales/*.json`.
4. Ejecuta `npm run lint` y `npm test`: cualquier importación que quede apunta a una ruta que ya no existe.

## Manifiesto del widget

`widget.manifest.json`, en la raíz, describe el widget fuera del código. Un test (`tests/boundaries/widgetManifest.test.ts`) lo mantiene coherente con `package.json`.

Ejemplo de un widget creado desde el template:

```json
{
  "name": "my-widget",
  "version": "0.1.0",
  "dynamicUi": "<versión exacta de @dynamic-framework/ui-react>",
  "template": "@dynamic-framework/dynamic-react-vite-base-template@<versión del template>",
  "theme": null,
  "design": [
    { "name": "Pantalla principal", "url": "https://www.figma.com/design/..." }
  ]
}
```

| Campo | Quién lo edita | Regla |
|-------|----------------|-------|
| `name` | Quien crea el widget, junto con `name` de `package.json` | Igual a `name` de `package.json` |
| `version` | Quien publica, en cada versión del widget | Igual a `version` de `package.json` |
| `dynamicUi` | Quien actualiza `@dynamic-framework/ui-react` | Igual al pin exacto de la dependencia en `package.json`; un rango (`^`, `~`) hace fallar el test |
| `template` | Nadie: registra el template y la versión de los que sale el widget | Forma `paquete@versión` |
| `theme` | Quien crea el widget, si usa un theme publicado como paquete | `null` o `paquete@versión` |
| `design` | Quien crea el widget, opcional | Lista de `{ "name": "...", "url": "https://..." }` con las referencias de diseño |

## Punto de montaje

El widget se monta en los elementos con el atributo `data-widget="widgetName"`, como el contenedor de `index.html`. Si no hay ninguno, se monta en el elemento con `id="widgetName"`, de modo que el `id` sigue funcionando. El nombre se define en la constante `WIDGET_NAME` de `src/app/main.tsx` y es lo que se cambia al crear un widget desde este template. Para montar varias instancias en una misma página, cada contenedor lleva el mismo `data-widget` y cada uno recibe su propia instancia.

La búsqueda de contenedores espera a `DOMContentLoaded` cuando el documento aún se está cargando, de modo que `main.js` funciona igual enlazado en el `<head>` que al final del `<body>`.

## Configuración de Modyo

Para hacer push a Modyo:

1. Copia el archivo de configuración (`.modyo` es el método recomendado):
   ```bash
   cp .modyo.example .modyo   # recomendado
   # o alternativamente:
   cp .env.example .env       # soportado, pero deprecado en el CLI
   ```

2. Configura las variables requeridas:
   - `MODYO_ACCOUNT_URL` - URL de tu cuenta Modyo
   - `MODYO_TOKEN` - Token de acceso (generar en Admin > Settings > API Access)
   - `MODYO_WIDGET_NAME` - Nombre del widget en la plataforma
   - `MODYO_SITE_HOST` - Host del sitio destino (o `MODYO_SITE_ID`)

3. Ejecuta el push:
   ```bash
   npm run push           # Build + push a Modyo
   npm run push:publish   # Build + push + publicar
   npm run push:debug     # Build + push con logging de diagnóstico
   ```

Ver `.modyo.example` para todas las opciones disponibles y la [documentación de Modyo CLI](https://docs.modyo.com/en/platform/tools/cli.html) para más detalles.

## Code Splitting

El build genera un único `main.js` en formato IIFE (`format: 'iife'` en `vite.config.ts`). Con ese formato no hay chunks: si el código usara `import()` o `React.lazy`, Vite incluiría el módulo importado dentro del mismo `main.js` y no emitiría archivos aparte, así que la descarga no se reduce. Por eso ESLint no admite `import()` en `src/` (ver [Grafo de importaciones](#grafo-de-importaciones)).

Para que `main.js` pese menos, lo que funciona es no importar lo que la página no usa:

- Registra en `availablePortals` solo los modales que el widget abre (ver [Agregar una feature](#agregar-una-feature)).
- Importa una feature solo desde donde se usa: importar su `index.ts` incluye en el bundle los módulos que ejecutan código al cargarse, como el cliente HTTP con axios, aunque ninguna página use la feature.
- Los iconos de Lucide ya se recortan en el build (ver [Iconos y tamaño del bundle](#iconos-y-tamaño-del-bundle)).

## Linting y Formato

El template incluye:

- **ESLint**: linting de TypeScript/React (flat config, `eslint.config.js`).
- **Stylelint**: linting de CSS/SCSS (`stylelint-config-twbs-bootstrap` y reglas propias en `.stylelintrc`).
- **Husky**: hooks de git. `pre-commit` ejecuta lint-staged y `commit-msg` ejecuta Commitlint.
- **lint-staged**: `eslint --fix` sobre los `.ts`/`.tsx` de `src/` y `src/config/*.json`, y `stylelint --fix` sobre los `.scss` de `src/`, solo en los archivos staged.
- **Commitlint**: mensajes con conventional commits; los tipos admitidos son `feat`, `fix`, `docs`, `chore`, `style`, `refactor` y `test`.

## Testing

```bash
# Ejecutar tests
npm run test

# Ejecutar tests en modo watch
npm run test:watch
```

El template no trae el proveedor de coverage. Para medirlo, instala `@vitest/coverage-v8` en la misma versión mayor que `vitest` y ejecuta `npm run test -- --coverage`.

## Manejo de Liquid

Modyo procesa el contenido de un widget como una plantilla Liquid antes de servirlo, por lo que cualquier `{{ }}` o `{% %}` que aparezca "suelto" en el bundle (por ejemplo dentro de un string JS, un JSON o una clase CSS) puede ser interpretado y removido/reemplazado por el motor de Liquid del sitio, rompiendo el widget en producción.

Para evitar esto, el template incluye:

- **`src/config/liquid.json` + `src/shared/lib/liquidParser.ts`**: helper que resuelve tags Liquid (`{{site.language}}`, `{{vars.mi-variable}}`, etc.) contra un mock local en desarrollo (usando `liquidjs`) y los deja pasar tal cual en producción, donde Modyo los reemplaza en el servidor. Úsalo cuando necesites leer variables o contexto del sitio (`site.*`, `vars.*`) desde el código:
  ```ts
  import liquidParser from '@/shared/lib/liquidParser';

  const siteName = liquidParser.parse('{{site.name}}');
  ```
  Los valores mock para desarrollo local se configuran en `src/config/liquid.json`. Ni ese archivo ni `liquidjs` llegan al build: `src/config/liquidConfig.ts` solo inicializa el parser cuando `import.meta.env.DEV` es verdadero, y en el build ese bloque se elimina. La excepción es construir con `NODE_ENV=development` heredado del entorno, que deja el bloque dentro; por eso `liquid.json` nunca lleva credenciales reales.

- **Plugin `escapeLiquidInStrings` (`.vite/plugins/escapeLiquidInStrings.ts`)**: se ejecuta solo en `build` y convierte los string literals exactos `"{{"` y `"}}"` (con comillas simples o dobles) del bundle en `"\u007B\u007B"` / `"\u007D\u007D"`. Son los que traen algunas dependencias, por ejemplo como delimitadores por defecto. JavaScript los interpreta igual, y Liquid ya no los ve. Un string que **contiene** `{{` junto a otro texto no se escapa.

**¿Cuándo usar cada uno?**
- Si necesitas **leer** una variable/config que vive en el sitio Modyo (idioma, nombre del sitio, variables custom), la convención del template es declararla una única vez en `src/config/widgetConfig.ts` usando `liquidParser.parse(...)` y exportarla desde ahí (como ya se hace con `SITE_LANG`, `SITE_NAME`, `VARS_CURRENCY`, etc.). El resto del código debe importar esas constantes desde `widgetConfig.ts` en vez de llamar a `liquidParser` directamente en cada archivo:
  ```ts
  // src/config/widgetConfig.ts
  export const SITE_NAME = liquidParser.parse('{{site.name}}');

  // en cualquier otro componente/módulo
  import { SITE_NAME } from '@/config/widgetConfig';
  ```
  Esto mantiene un solo punto de import de `liquidParser`, evita duplicar tags Liquid dispersos por el código y facilita ubicar/mockear todas las variables del sitio en un solo lugar. Solo importa `liquidParser` directamente si estás agregando una variable nueva a `widgetConfig.ts`.
- Si tienes **texto** (traducciones, contenido) con `{{` o `}}`, Modyo lo interpretará como Liquid: el plugin solo cubre los literales exactos `"{{"` y `"}}"`. Evita esas secuencias en el texto. Las traducciones interpolan con llaves simples (`{lang}`), que es como las configura `configureI18n` de Dynamic. Si ves comportamientos raros con Liquid en producción que no ocurren en local, revisa primero si el string problemático contiene `{{` o `}}`.

## Variables obligatorias

`src/config/widgetConfig.ts` se organiza por bloques: el núcleo y uno por cada módulo opcional. Cada bloque declara sus variables Liquid; las que el widget necesita para funcionar se declaran con `requireVariable`, que las registra como obligatorias:

```ts
export const API_BASE_URL = requireVariable('vars.api-base-url', liquidParser.parse('{{vars.api-base-url}}'));
```

El nombre va sin llaves y el tag se escribe literal: Modyo sustituye cada `{{...}}` del bundle, incluido uno que solo sirviera para mostrar el nombre. `tests/config/widgetConfig.test.ts` comprueba que cada nombre coincide con su tag.

El núcleo exige `vars.api-base-url`. Las variables de moneda (`vars.currency-*`) no son obligatorias: si alguna llega sin resolver, el widget no fija la moneda y Dynamic usa su formato por defecto.

### Gate de configuración

Al renderizar, `App` llama a `getMissingVariables()`. Si falta alguna variable obligatoria, el widget pinta cuáles faltan en lugar de la página, en vez de fallar en silencio con peticiones a una URL vacía. Una variable falta si llega vacía (Modyo la deja así cuando el sitio no la define) o con el tag Liquid tal cual.

Con `vars.use-mocks` en `"true"` no se exige ninguna: el widget trabaja con datos de prueba. Es el caso en desarrollo, con los valores de `src/config/liquid.json`.

## Módulos opcionales

El template no trae instalado ningún módulo opcional. Cada receta indica la dependencia, los archivos, las variables que añade a `widgetConfig.ts` y cómo quitarlo.

| Módulo | Para qué | Receta |
|--------|----------|--------|
| Router | Navegación entre pantallas dentro del widget, con React Router | [`docs/recipes/router.md`](docs/recipes/router.md) |
| Modyo Content | Leer entradas de un espacio de Modyo Content con `@modyo/sdk` | [`docs/recipes/modyo-content.md`](docs/recipes/modyo-content.md) |

Quitar un módulo es borrar su bloque de `widgetConfig.ts`, junto con su dependencia y sus archivos; su variable deja de ser obligatoria en el mismo paso.

## Qué publica el widget

`npm run build` deja en `dist/` exactamente tres archivos, que son los que sube
`npm run push`:

| Archivo | Qué es |
| --- | --- |
| `main.js` | El código del widget: React, sus dependencias y los iconos de Lucide que usa. |
| `main.css` | Solo los estilos propios del widget (`src/styles/base.scss`). |
| `index.html` | La página de desarrollo. Modyo no la renderiza. |

El CSS de Dynamic UI, el theme y las fuentes los carga el sitio una vez para
toda la página; el widget no los lleva (ver la sección siguiente).

`tests/boundaries/distContents.test.ts` construye el widget y falla si `dist/`
contiene cualquier otro archivo. Lo más habitual que lo hace fallar:

- **Un archivo en `public/`.** Vite copia `public/` entero a `dist/`.
- **Una imagen importada en el código que Vite emite como archivo aparte**
  (`import logo from './logo.png'`). Vite solo incrusta en el bundle las de
  menos de 4 KB; el resto sale como archivo en `dist/` y no se publicaría.

Las imágenes se sirven desde el sitio (gestor de archivos de Modyo o un CDN) y
se referencian por URL. Un SVG pequeño puede ir en línea como componente con
`vite-plugin-svgr`, que el template trae configurado para eso:

```tsx
import Logo from './logo.svg?react';
```

## Estilos: qué lleva el widget y qué pone el sitio

**El sitio de Modyo carga el CSS de Dynamic UI y el theme una vez para toda la página. El widget solo lleva sus estilos propios.**

Por eso `src/app/main.tsx` importa únicamente `@/styles/base.scss` y **no** `dynamic-ui.css`. Si el widget incluyera el CSS de Dynamic:

- Con N widgets en una página, se descargarían N copias de más del mismo CSS.
- Cada copia redeclararía `:root` con los valores por defecto de Dynamic. Según el orden en que el sitio enlace `main.css` y el theme, **los tokens de tu marca quedarían pisados**.
- Un widget con una versión de Dynamic distinta a la del sitio metería dos `:root` incompatibles en la misma página.

`cssCodeSplit: false` en `vite.config.ts` hace que los estilos **propios** del widget vayan en un solo archivo, `dist/main.css`.

### Qué no define el widget

Colores, tipografía, radios y zonas de theme vienen de Dynamic y del theme del sitio. En `src/` no se permiten:

- colores hex o con nombre; en los objetos de estilo de TSX (`style={{}}`), las propiedades de color (`color`, `background`, `borderColor`, `fill`…) solo aceptan `var(--…)`, y en los shorthands (`border`, `outline`, `boxShadow`…) el color también va con `var(--…)`, por ejemplo `'1px solid var(--bs-border-color)'`;
- `font`, `font-family` ni `border-radius` (tampoco los radios por esquina), tampoco en `style={{}}`;
- variables SCSS (`$x`) ni `@import`;
- el CSS de Dynamic, ni compilado (`dynamic-ui.css`) ni desde sus fuentes (`@dynamic-framework/ui-react/src/style/...`);
- selectores `[data-bs-theme]`, con o sin valor: el widget solo pone el atributo en el JSX.

Las clases propias siguen el patrón `.widget-name__bloque--variante`. Al crear tu widget, renombra `widget-name` en `index.html`, `src/styles/base.scss` y `selector-class-pattern` de `.stylelintrc`.

Correcto:

```scss
@use "@dynamic-framework/ui-react/src/style/abstracts/+import" as df;

.widget-name__summary {
  color: var(--bs-body-color);
  background-color: rgba(var(--bs-primary-rgb), .1);

  @include df.media-breakpoint-up(md) {
    padding: var(--bs-ref-spacer-4);
  }
}
```

```tsx
<div className="widget-name__summary rounded-2 fs-5" data-bs-theme="dark">
```

Incorrecto:

```scss
$brand: #336699;

.summary {
  font-family: Arial, sans-serif;
  color: $brand;
  border-radius: 8px;
}

[data-bs-theme="dark"] .summary {
  color: white;
}
```

```tsx
<div style={{ color: '#336699', borderRadius: 8 }}>
```

El único parcial de Dynamic que se puede usar es `abstracts/+import`: expone funciones y mixins (por ejemplo, `media-breakpoint-up`) y no emite CSS. Sus variables SCSS tampoco se usan; en su lugar van las custom properties `var(--bs-*)`.

Lo comprueban `npm run stylelint` (archivos `.css` y `.scss`) y `tests/boundaries/styleBoundaries.test.ts` (también `.ts` y `.tsx`, incluidos los `style={{}}`). Cada error indica archivo, línea y qué usar en su lugar.

### Desarrollo local

Para que `npm run dev` se vea bien, `index.html` enlaza el CSS de Dynamic desde el CDN:

```html
<link rel="stylesheet" href="https://cdn.dynamicframework.dev/assets/2.12.1/ui-react/css/dynamic-ui.min.css">
```

Modyo **nunca renderiza `index.html`**: compone la página con su propio template e inyecta `main.js` y `main.css`. Nada de lo que pongas ahí llega al widget publicado.

Dos detalles que importan:

- **La URL tiene que ser absoluta.** Una ruta a `node_modules` la resuelve Vite y el CSS acaba otra vez dentro de `dist/main.css`: el `<link>` parece inocente y el build engorda igual.
- **La versión va escrita a mano**, así que puede desalinearse de `package.json`. El test `tests/boundaries/dynamicCssLink.test.ts` falla si la URL no es absoluta o si la versión no coincide con la instalada.

Sin el theme de tu sitio ves los tokens por defecto de Dynamic, no los de tu marca. Para verlos en local, añade a `index.html` un `<link>` al theme **después** del de Dynamic, para que sus valores prevalezcan. La URL sale del `<head>` del sitio publicado (el `<link>` a `/stylesheets/...css`) y también tiene que ser absoluta:

```html
<link rel="stylesheet" href="https://cdn.dynamicframework.dev/assets/2.12.1/ui-react/css/dynamic-ui.min.css">
<link rel="stylesheet" href="https://tu-sitio.ejemplo.com/stylesheets/site-theme.css">
```

> `npm run preview` sirve el `dist/` ya construido. Su `index.html` conserva el `<link>` al CDN, así que el CSS de Dynamic se ve; el resto es lo que recibe Modyo: `main.js` y `main.css`. Como ahí nadie resuelve los tags Liquid, el widget muestra el aviso de variables que faltan (ver [Gate de configuración](#gate-de-configuración)). Para trabajar con los valores de `src/config/liquid.json` usa `npm run dev`; para ver el widget con el sitio real, el preview de Modyo CLI.

## Iconos y tamaño del bundle

El template incluye un segundo plugin local de Vite, `lucideSubset`
(`.vite/plugins/lucideSubset.ts`), registrado en `vite.config.ts` junto a
`escapeLiquidInStrings`.

### Qué hace

`@dynamic-framework/ui-react` resuelve los iconos por nombre en tiempo de
ejecución: hace `import * as LucideIcons from 'lucide-react'` y luego, en
`DIconBase`, `const icons = LucideIcons` seguido de `icons[nombre]` —ese `icons`
es el objeto namespace del módulo, no el export `icons` de Lucide—. Ese acceso
dinámico impide el tree-shaking, así que sin el
plugin el bundle se lleva **el catálogo completo de Lucide** (más de 1,6k
módulos de icono) para pintar unos pocos.

El plugin intercepta el especificador `lucide-react` **solo cuando quien lo
importa es código de Dynamic**, y le sirve un módulo con los iconos que este
widget necesita. Para la biblioteca no cambia nada: sigue recibiendo un objeto
namespace y ese `icons[nombre]` sigue funcionando.

Los iconos incluidos son la unión de:

1. **Catastro del código**: los string literals en posición de valor de
   `src/**/*.{ts,tsx}` que coincidan con un nombre real de icono de Lucide. Se
   recolectan con el parser de TypeScript, y **no solo en posición de atributo
   JSX**: si pasas el nombre a un envoltorio (`<MyLink icon="Book" />`), el
   literal se detecta en el sitio de llamada. También los que están en arrays,
   en mapas de constantes, en valores de `enum` o como default de una prop. Los
   literales en posición de tipo y los especificadores de `import` no cuentan.
2. **Núcleo de Dynamic**: los iconos que los propios componentes usan por dentro
   (la X de `DAlert`, los chevrons de `DCollapse`, el ojo de `DInputPassword`,
   etc.). No hay que declararlos: se incluyen siempre. La lista se lee de
   `dist/icons-core.json` del `@dynamic-framework/ui-react` instalado; si el
   paquete no la publica, el plugin usa una lista de respaldo y lo avisa en el
   build. `icons-manifest.json` indica cuál se usó en `coreSource`.
3. **La opción `include`** (ver abajo).

Solo actúa en `build`. En `npm run dev` y en el preview del CLI de Modyo el
widget ve Lucide entero, que es lo que quieres mientras iteras: cualquier nombre
de icono funciona sin tocar configuración.

Cada build escribe `node_modules/.vite/icons-manifest.json` con la lista final y
de dónde vino cada nombre, e imprime esa ruta al terminar. Queda fuera de
`dist/`, así que no se publica con el widget. Es el primer sitio donde mirar si
un icono no aparece.

### Cómo declarar iconos calculados

Si el nombre del icono se decide en tiempo de ejecución, el catastro solo lo
encuentra si el nombre está como string literal **en alguna parte** de `src/`.
Eso cubre casi todos los casos reales:

```tsx
// Se detecta: los tres nombres son literales del archivo.
const TYPE_ICONS = { car: 'Car', home: 'Home', health: 'HeartPulse' };
<DIcon icon={TYPE_ICONS[type]} />
```

```tsx
// Se detecta: basta con declarar los nombres posibles en una constante.
export const WIDGET_ICONS = ['Rocket', 'Star', 'Wallet'] as const;
```

El único caso que el catastro **no** puede ver es un nombre que nunca aparece en
el código, por ejemplo si llega desde la API de Modyo o desde un JSON de
contenido. Para eso está `include`, en `vite.config.ts`:

```ts
lucideSubset({
  // Nombres que este widget puede pintar y que no están como literal en src/.
  include: ['Rocket', 'Star', 'Wallet'],
  strict: false,
}),
```

`include` va en `vite.config.ts` y no en `src/config/widgetConfig.ts` a
propósito: es configuración de build, la revisa `tsc` junto al resto de la
config, y mantener una sola fuente evita que el plugin tenga que interpretar
código de la aplicación. Si prefieres tenerlo junto al resto de la configuración
del widget, la vía documentada arriba —una constante con los nombres en `src/`—
consigue lo mismo sin pasar por `include`.

Si un nombre de `include` no existe en Lucide, el build avisa y lo omite en vez
de fallar.

### Opciones

| Opción | Por defecto | Qué hace |
| --- | --- | --- |
| `include` | `[]` | Nombres de icono que no aparecen como literal en `src/`. |
| `strict` | `false` | Si es `true`, **falla el build** cuando encuentra una prop de icono con expresión no literal (`icon={algo}`, `iconStart={…}`, `iconEnd={…}`) en `src/` y `include` no aporta ningún nombre válido de icono, ya sea porque está vacío o porque todos sus nombres se descartaron por no ser exports de Lucide. Útil para garantizar que ningún icono se pierda en silencio. Está desactivado por defecto porque el propio template tiene dos envoltorios legítimos (`MyLink`, `EmptyState`) cuyos nombres sí están como literales en el código que los invoca. |
| `disabled` | `false` | Desactiva el plugin por completo; el bundle vuelve a llevar Lucide entero. |
| `manifestFile` | `node_modules/.vite/icons-manifest.json` | Ruta del manifest de iconos, absoluta o relativa a la raíz del proyecto. |

### Cómo desactivarlo

En `vite.config.ts`, pasa `disabled: true`:

```ts
lucideSubset({ disabled: true }),
```

o quita la entrada del array `plugins`. Es lo primero que conviene probar si
sospechas que el plugin es la causa de un icono que no se pinta.

### Si un icono no aparece

El modo de fallo es **silencioso**: cuando el nombre no está en el bundle,
Dynamic no lanza ningún error, renderiza `<i class="d-icon bi bi-<Nombre>"></i>`
y simplemente no se ve nada. Es lo mismo que ocurre con cualquier nombre que no
exista en Lucide; el plugin amplía el conjunto de nombres que caen en ese camino.
Para diagnosticar:

1. Mira `node_modules/.vite/icons-manifest.json` y comprueba si el nombre está
   en `included`.
2. Si no está, revisa que sea un nombre válido de Lucide en PascalCase
   (`ArrowLeft`, no `arrow-left` ni `check`).
3. Agrégalo con `include`, o declara el nombre como literal en `src/`.
4. Para comprobar que el plugin es la causa, compara con `disabled: true`.

## Internacionalización (i18n)

El template usa [`i18next`](https://www.i18next.com/) junto a [`react-i18next`](https://react.dev.i18next.com/) como librería de internacionalización, integradas mediante el helper `configureI18n` de `@dynamic-framework/ui-react`.

Configuración (`src/config/i18nConfig.ts`):

```ts
import { configureI18n } from '@dynamic-framework/ui-react';

import en from '@/locales/en.json';
import es from '@/locales/es.json';

import { DEFAULT_LANGUAGE, SITE_LANG } from './widgetConfig';

const resources = {
  es: { translation: es },
  en: { translation: en },
};

configureI18n(resources, { lng: SITE_LANG, fallbackLng: DEFAULT_LANGUAGE });
```

- Las traducciones viven en `src/locales/*.json` (uno por idioma).
- El idioma inicial se toma de `SITE_LANG` (resuelto vía Liquid desde `{{site.language}}`, ver [Manejo de Liquid](#manejo-de-liquid)), de modo que el widget arranca en el idioma configurado en el sitio de Modyo.
- El idioma por defecto es `es` y se cambia en `DEFAULT_LANGUAGE`, en `src/config/widgetConfig.ts`. Si `{{site.language}}` llega vacío o sin resolver, `SITE_LANG` toma ese valor; también es el idioma de respaldo de i18next (`fallbackLng`).
- Para cambiar de idioma en runtime se expone `changeLanguage(lang)` desde el mismo archivo.
- En componentes se usa el hook estándar de `react-i18next`:
  ```tsx
  import { useTranslation } from 'react-i18next';

  const { t } = useTranslation();
  t('siteLang', { lang: SITE_LANG });
  ```

**Si quieres usar otra librería de i18n**, ten en cuenta que `@dynamic-framework/ui-react` expone algunos componentes que dependen internamente de `i18next`/`react-i18next` (a través de `configureI18n`), por lo que no podrás remover esas dependencias por completo. Puedes sí evitar usar `configureI18n` y `useTranslation` en tu propio código y reemplazarlos por tu librería preferida (p. ej. `react-intl`, `lingui`), inicializándola en paralelo y usándola en tus componentes; solo asegúrate de mantener sincronizado el idioma inicial con `SITE_LANG` si necesitas que ambos sistemas reflejen el idioma del sitio.

## Build de Producción

```bash
npm run build
```

Output en `dist/` (ver [Qué publica el widget](#qué-publica-el-widget)):
- `main.js` - Bundle JavaScript
- `main.css` - Estilos compilados
- `index.html` - Página de desarrollo

## Recursos

- [Dynamic UI Storybook](https://react.dynamicframework.dev/)
- [Dynamic Framework Docs](https://dynamic.modyo.com/)
- [Vite Documentation](https://vite.dev/)
- [Modyo CLI Documentation](https://docs.modyo.com/en/platform/tools/cli.html)

## Licencia

MIT
