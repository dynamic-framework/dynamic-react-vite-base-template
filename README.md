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

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Configura las variables requeridas en `.env`:
   - `MODYO_ACCOUNT_URL` - URL de tu cuenta Modyo
   - `MODYO_TOKEN` - Token de acceso (generar en Admin > Settings > API Access)
   - `MODYO_SITE_HOST` - Host del sitio destino

3. Ejecuta el push:
   ```bash
   npm run push           # Solo push
   npm run push:publish   # Push + publicar
   ```

Ver `.env.example` para todas las opciones disponibles y la [documentación de Modyo CLI](https://docs.modyo.com/en/platform/tools/cli.html) para más detalles.

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

## Build de Producción

```bash
npm run build
```

Output en `build/`:
- `main.js` - Bundle JavaScript
- `main.css` - Estilos compilados

## Recursos

- [Dynamic UI Storybook](https://react.dynamicframework.dev/)
- [Dynamic Framework Docs](https://dynamic.modyo.com/)
- [Vite Documentation](https://vite.dev/)
- [Modyo CLI Documentation](https://docs.modyo.com/en/platform/cli)

## Licencia

MIT
