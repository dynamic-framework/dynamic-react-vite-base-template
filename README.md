# Dynamic React Vite Base Template (Code Splitting)

Variante del template base con soporte para code splitting. Usa esta rama cuando tu widget necesite dividir el bundle en chunks que se cargan dinámicamente.

> **¿No necesitas code splitting?** Usa la [rama master](https://github.com/dynamic-framework/dynamic-react-vite-base-template) en su lugar.

## Cuándo Usar Esta Rama

✅ **Usa code splitting si:**
- Tu widget tiene múltiples vistas/tabs pesadas
- El bundle supera ~500KB sin comprimir
- Tienes componentes que no se cargan siempre (modales complejos, features opcionales)
- Quieres mejorar el tiempo de carga inicial

❌ **NO necesitas code splitting si:**
- Tu widget es simple (< 300KB)
- Todas las vistas se usan frecuentemente
- El widget carga en una sola página sin navegación interna

## Diferencias con master

Esta rama agrega:

| Archivo | Cambio |
|---------|--------|
| package.json | +`@dynamic-framework/vite-plugin-transform-dynamic-imports` |
| vite.config.ts | +Plugin para transformar dynamic imports |

## Cómo Funciona

El plugin `vite-plugin-transform-dynamic-imports` transforma los imports dinámicos para que funcionen con el widget manager de Modyo:

```javascript
// Tu código
const HeavyModal = lazy(() => import('./components/HeavyModal'));

// El plugin transforma a:
import(window['resourceBasePath-{{widget.wid}}'] + 'HeavyModal.chunk.js')
```

Esto permite que los chunks se carguen desde la URL correcta del widget en Modyo.

## Inicio Rápido

```bash
# Clonar template (rama con chunks)
git clone -b feat/with-chunks https://github.com/dynamic-framework/dynamic-react-vite-base-template.git my-widget
cd my-widget

# Instalar dependencias
npm install

# Iniciar desarrollo
npm run dev
```

## Uso de Code Splitting

### React.lazy para componentes

```tsx
import { lazy, Suspense } from 'react';
import { DSkeleton } from '@dynamic-framework/ui-react';

// Importar componente pesado de forma lazy
const HeavyChart = lazy(() => import('./components/HeavyChart'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));

function App() {
  return (
    <Suspense fallback={<DSkeleton height={200} />}>
      <HeavyChart />
    </Suspense>
  );
}
```

### Dividir por rutas/tabs

```tsx
import { lazy, Suspense, useState } from 'react';

const OverviewTab = lazy(() => import('./tabs/Overview'));
const AnalyticsTab = lazy(() => import('./tabs/Analytics'));
const SettingsTab = lazy(() => import('./tabs/Settings'));

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <Suspense fallback={<Loading />}>
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </Suspense>
  );
}
```

## Output de Build

```bash
npm run build
```

Output en `build/`:
```
build/
├── main.js                    # Entry point
├── main.css                   # Estilos
├── Overview.abc123.chunk.js   # Chunk lazy
├── Analytics.def456.chunk.js  # Chunk lazy
└── Settings.ghi789.chunk.js   # Chunk lazy
```

## Configuración del Plugin

El plugin usa configuración por defecto. Para personalizar:

```typescript
// vite.config.ts
import transformDynamicImports from '@dynamic-framework/vite-plugin-transform-dynamic-imports';

export default defineConfig({
  plugins: [
    transformDynamicImports({
      // Placeholder del widget ID (default)
      widgetPlaceholder: '{{widget.wid}}',

      // Patrón de archivos chunk (default)
      chunkFilePattern: '.chunk.js',

      // Nombre del entry file (default)
      entryFileName: 'main.js',

      // Template URL para imports estáticos en chunks
      staticImportUrlTemplate: '{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js',
    }),
  ],
});
```

## Requisitos en Modyo

Para que los chunks funcionen en Modyo, el widget debe definir la variable global de base path. Esto se configura automáticamente por el widget manager.

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia servidor de desarrollo |
| `npm run build` | Compila para producción (genera chunks) |
| `npm run preview` | Preview del build |
| `npm run push` | Build + push a Modyo |
| `npm run push:publish` | Build + push + publicar a Modyo |

## Configuración de Modyo

Para hacer push a Modyo con code splitting:

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Configura las variables en `.env`:
   ```bash
   MODYO_ACCOUNT_URL=https://tu-cuenta.modyo.cloud
   MODYO_TOKEN=tu-token
   MODYO_SITE_HOST=tu-sitio
   MODYO_ZIP=true  # ⚠️ REQUERIDO para code splitting
   ```

3. Ejecuta el push:
   ```bash
   npm run push
   ```

> **Importante:** `MODYO_ZIP=true` es obligatorio para que los chunks se suban correctamente.

Ver `.env.example` para todas las opciones y la [documentación de Modyo CLI](https://docs.modyo.com/en/platform/tools/cli.html) para más detalles.

## Recursos

- [Plugin Documentation](https://github.com/dynamic-framework/vite-plugin-transform-dynamic-imports)
- [Template Base (sin code split)](https://github.com/dynamic-framework/dynamic-react-vite-base-template)
- [React.lazy Documentation](https://react.dev/reference/react/lazy)
- [Vite Code Splitting](https://vite.dev/guide/build.html#chunking-strategy)

## Licencia

MIT
