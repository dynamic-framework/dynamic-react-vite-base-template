# Dynamic React Vite Base Template

Template base para crear widgets con Dynamic Framework usando Vite.

## Stack

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 19.x | UI Library |
| TypeScript | 5.9.x | Type safety |
| Vite | 7.x | Build tool |
| Dynamic UI | 2.0.x | Component library |
| i18next | 25.x | Internacionalización |

## Requisitos

- Node.js >= 22.0.0
- npm >= 10.x

## Inicio Rápido

```bash
# Clonar template
git clone https://github.com/dynamic-framework/dynamic-react-vite-base-template.git my-widget
cd my-widget

# Instalar dependencias
npm install

# Iniciar desarrollo
npm run dev
```

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia servidor de desarrollo |
| `npm run build` | Compila para producción |
| `npm run preview` | Preview del build de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run stylelint` | Ejecuta Stylelint para CSS/SCSS |
| `npm run test` | Ejecuta tests con Vitest |
| `npm run push` | Build + push a Modyo |
| `npm run push:publish` | Build + push + publish a Modyo |
| `npm run push:debug` | Build + push con logging de diagnóstico |

## Estructura del Proyecto

```
├── public/              # Assets estáticos
├── src/
│   ├── components/      # Componentes React
│   ├── styles/          # Estilos SCSS
│   ├── App.tsx          # Componente principal
│   └── main.tsx         # Entry point
├── tests/               # Tests
├── index.html           # HTML template
├── vite.config.ts       # Configuración Vite
├── tsconfig.json        # Configuración TypeScript
└── package.json
```

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

Para widgets grandes que requieren code splitting, usa la rama `feat/with-chunks`:

```bash
git checkout feat/with-chunks
```

Esta rama incluye configuración adicional para dividir el bundle en chunks que se cargan dinámicamente. Ver [README de feat/with-chunks](https://github.com/dynamic-framework/dynamic-react-vite-base-template/tree/feat/with-chunks) para más información.

## Linting y Formato

El template incluye:

- **ESLint** - Linting de TypeScript/React (flat config)
- **Stylelint** - Linting de CSS/SCSS (Bootstrap config)
- **Husky** - Git hooks para pre-commit
- **lint-staged** - Lint solo archivos staged
- **Commitlint** - Validación de mensajes de commit (conventional commits)

## Testing

```bash
# Ejecutar tests
npm run test

# Ejecutar tests en modo watch
npm run test -- --watch

# Ejecutar con coverage
npm run test -- --coverage
```

## Manejo de Liquid

Modyo procesa el contenido de un widget como una plantilla Liquid antes de servirlo, por lo que cualquier `{{ }}` o `{% %}` que aparezca "suelto" en el bundle (por ejemplo dentro de un string JS, un JSON o una clase CSS) puede ser interpretado y removido/reemplazado por el motor de Liquid del sitio, rompiendo el widget en producción.

Para evitar esto, el template incluye:

- **`src/config/liquid.json` + `src/utils/liquidParser.ts`**: helper que resuelve tags Liquid (`{{site.language}}`, `{{vars.mi-variable}}`, etc.) contra un mock local en desarrollo (usando `liquidjs`) y los deja pasar tal cual en producción, donde Modyo los reemplaza en el servidor. Úsalo cuando necesites leer variables o contexto del sitio (`site.*`, `vars.*`) desde el código:
  ```ts
  import liquidParser from '../utils/liquidParser';

  const siteName = liquidParser.parse('{{site.name}}');
  ```
  Los valores mock para desarrollo local se configuran en `src/config/liquid.json`.

- **Plugin `escapeLiquidInStrings` (`.vite/plugins/escapeLiquidInStrings.ts`)**: se ejecuta solo en `build` y escapa los literales `"{{"` y `"}}"` que queden en el bundle final (por ejemplo, texto de UI que contenga esos caracteres sin ser Liquid intencional) convirtiéndolos a `\u007B\u007B` / `\u007D\u007D`. Esto es transparente para JS pero invisible para el parser de Liquid, evitando falsos positivos al momento del renderizado en Modyo.

**¿Cuándo usar cada uno?**
- Si necesitas **leer** una variable/config que vive en el sitio Modyo (idioma, nombre del sitio, variables custom), la convención del template es declararla una única vez en `src/config/widgetConfig.ts` usando `liquidParser.parse(...)` y exportarla desde ahí (como ya se hace con `SITE_LANG`, `SITE_NAME`, `VARS_CURRENCY`, etc.). El resto del código debe importar esas constantes desde `widgetConfig.ts` en vez de llamar a `liquidParser` directamente en cada archivo:
  ```ts
  // src/config/widgetConfig.ts
  export const SITE_NAME = liquidParser.parse('{{site.name}}');

  // en cualquier otro componente/módulo
  import { SITE_NAME } from '../config/widgetConfig';
  ```
  Esto mantiene un solo punto de import de `liquidParser`, evita duplicar tags Liquid dispersos por el código y facilita ubicar/mockear todas las variables del sitio en un solo lugar. Solo importa `liquidParser` directamente si estás agregando una variable nueva a `widgetConfig.ts`.
- Si tienes **texto estático** (traducciones, contenido) que por coincidencia contiene `{{` o `}}` y no quieres que Modyo lo interprete → el plugin ya lo resuelve automáticamente en build, no requiere acción extra. Si ves comportamientos raros con Liquid en producción que no ocurren en local, revisa primero si el string problemático pasa por alguno de estos dos mecanismos.

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

1. **Catastro del código**: todos los string literals de `src/**/*.{ts,tsx}` que
   coincidan con un nombre real de icono de Lucide. Se recolectan con el parser
   de TypeScript, y **no solo en posición de atributo JSX**: si pasas el nombre a
   un envoltorio (`<MyLink icon="Book" />`), el literal se detecta en el sitio de
   llamada. También los que están en arrays, en mapas de constantes o como
   default de una prop.
2. **Núcleo de Dynamic**: los iconos que los propios componentes usan por dentro
   (la X de `DAlert`, los chevrons de `DCollapse`, el ojo de `DInputPassword`,
   etc.). No hay que declararlos: se incluyen siempre.
3. **La opción `include`** (ver abajo).

Solo actúa en `build`. En `npm run dev` y en el preview del CLI de Modyo el
widget ve Lucide entero, que es lo que quieres mientras iteras: cualquier nombre
de icono funciona sin tocar configuración.

Cada build escribe `dist/icons-manifest.json` con la lista final y de dónde vino
cada nombre. Es el primer sitio donde mirar si un icono no aparece.

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
y simplemente no se ve nada. Eso ya pasa hoy con cualquier nombre que no exista
en Lucide; el plugin amplía el conjunto de nombres que caen en ese camino. Para
diagnosticar:

1. Mira `dist/icons-manifest.json` y comprueba si el nombre está en `included`.
2. Si no está, revisa que sea un nombre válido de Lucide en PascalCase
   (`ArrowLeft`, no `arrow-left` ni `check`).
3. Agrégalo con `include`, o declara el nombre como literal en `src/`.
4. Para confirmar que el plugin es la causa, compara con `disabled: true`.

## Internacionalización (i18n)

El template usa [`i18next`](https://www.i18next.com/) junto a [`react-i18next`](https://react.dev.i18next.com/) como librería de internacionalización, integradas mediante el helper `configureI18n` de `@dynamic-framework/ui-react`.

Configuración (`src/config/i18nConfig.ts`):

```ts
import { configureI18n } from '@dynamic-framework/ui-react';

import en from '../locales/en.json';
import es from '../locales/es.json';

import { SITE_LANG } from './widgetConfig';

const resources = {
  es: { translation: es },
  en: { translation: en },
};

configureI18n(resources, { lng: SITE_LANG });
```

- Las traducciones viven en `src/locales/*.json` (uno por idioma).
- El idioma inicial se toma de `SITE_LANG` (resuelto vía Liquid desde `{{site.language}}`, ver sección anterior), de modo que el widget arranca en el idioma configurado en el sitio de Modyo.
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

Output en `dist/`:
- `main.js` - Bundle JavaScript
- `main.css` - Estilos compilados

## Recursos

- [Dynamic UI Storybook](https://react.dynamicframework.dev/)
- [Dynamic Framework Docs](https://dynamic.modyo.com/)
- [Vite Documentation](https://vite.dev/)
- [Modyo CLI Documentation](https://docs.modyo.com/en/platform/tools/cli.html)

## Licencia

MIT
