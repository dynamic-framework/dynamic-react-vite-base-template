# Receta: router

Añade navegación entre pantallas dentro del widget con [React Router](https://reactrouter.com/). El template no lo trae instalado: un widget de una sola pantalla no lo necesita.

## Antes de empezar: qué pasa al recargar una subruta

El router cambia la URL del navegador sin pedir nada al servidor. Si la persona recarga (o abre un enlace directo a) una subruta, por ejemplo `/mi-sitio/cuentas/detalle/42` cuando el widget vive en la página `/mi-sitio/cuentas`, la petición llega a Modyo:

- **Sin delegación**, Modyo busca una página con esa ruta, no la encuentra y responde con el 404 del sitio (o redirige a la home, si el sitio tiene activada la opción *Redirect to home when a URL is not found*). El widget no llega a cargarse.
- **Con delegación**, Modyo sirve la misma página para cualquier subruta que no coincida con otra página del sitio, y el router del widget toma el control. Se activa en la página del widget: *Properties* → **Delegate child routes to this page**. Solo existe en páginas de tipo widget y en la home.

Por eso hay dos variantes:

| Variante | URLs | Requiere en Modyo | Variable Liquid |
|----------|------|-------------------|-----------------|
| `BrowserRouter` (recomendada) | `/mi-sitio/cuentas/detalle/42` | *Delegate child routes to this page* en la página del widget | `vars.router-basename` |
| `HashRouter` | `/mi-sitio/cuentas#/detalle/42` | Nada: lo que va tras `#` no llega al servidor | Ninguna |

Con `HashRouter` la recarga siempre funciona, pero las anclas (`#seccion`) de la página dejan de estar disponibles y las URLs son menos legibles.

Si en la misma página hay dos widgets con `BrowserRouter`, ambos leen la misma URL: cada uno debe usar un `basename` distinto o solo uno de ellos debe tener router.

## 1. Dependencia

```bash
npm install react-router
```

## 2. Variable (solo `BrowserRouter`)

`basename` es la ruta de la página donde vive el widget, sin barra final: `/mi-sitio/cuentas`. Defínela en Modyo como variable del sitio (`router-basename`) y añade su bloque en `src/config/widgetConfig.ts`, en cualquier punto debajo de la sección «Registro de obligatorias»:

```ts
// ─── Módulo: router ──────────────────────────────────────────────────────

export const ROUTER_BASENAME = requireVariable('vars.router-basename', liquidParser.parse('{{vars.router-basename}}'));
```

`requireVariable` la registra como obligatoria: si la página se publica sin ella, el widget pinta que falta `vars.router-basename` en lugar de navegar a rutas equivocadas.

Para desarrollo, añade su valor en `src/config/liquid.json` (las llaves van en orden alfabético; `npx eslint --fix` las reordena):

```json
"vars": {
  "router-basename": "/"
}
```

El servidor de desarrollo de Vite ya devuelve `index.html` para cualquier ruta, así que la recarga funciona en local sin configurar nada.

## 3. Rutas

En `src/app/App.tsx`, el router sustituye a la página única:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { CONTEXT_CONFIG, getMissingVariables, ROUTER_BASENAME } from '@/config/widgetConfig';

// ...

            {missingVariables.length > 0
              ? <MissingVariables names={missingVariables} />
              : (
                <BrowserRouter basename={ROUTER_BASENAME}>
                  <Routes>
                    <Route index element={<HomePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </BrowserRouter>
              )}
```

Para `HashRouter`, cambia `BrowserRouter` por `HashRouter`, quita `basename` y no añadas el bloque del paso 2.

Las rutas se declaran en `App.tsx` y cada una apunta a una página de `src/pages/`; las páginas componen features. Dentro de una feature, la navegación se hace con `useNavigate` o `<Link>` de `react-router` desde `ui/`.

## 4. Tests

`tests/app/App.test.tsx` sigue funcionando sin cambios: en los tests `liquid.json` aporta `router-basename: "/"` y jsdom arranca en `/`. Para probar una ruta concreta, envuelve la página en `MemoryRouter`:

```tsx
import { MemoryRouter } from 'react-router';

render(
  <MemoryRouter initialEntries={['/detalle/42']}>
    <Routes>
      <Route path="detalle/:id" element={<DetailPage />} />
    </Routes>
  </MemoryRouter>,
);
```

## Cómo quitarlo

1. `npm uninstall react-router`.
2. En `src/app/App.tsx`, sustituye el bloque `<BrowserRouter>` (o `<HashRouter>`) por la página que quede, por ejemplo `<HomePage />`, y quita la importación de `react-router` y de `ROUTER_BASENAME`.
3. Borra el bloque `Módulo: router` de `src/config/widgetConfig.ts` y `router-basename` de `src/config/liquid.json`.
4. Quita los `useNavigate`, `<Link>` y `MemoryRouter` que queden en `src/` y `tests/`.
5. En Modyo, quita la variable `router-basename` y desactiva *Delegate child routes to this page* en la página del widget.
6. Ejecuta `npm run lint`, `npm test` y `npm run build`.
