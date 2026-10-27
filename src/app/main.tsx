import { DContextProvider } from '@dynamic-framework/ui-react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import '@/config/i18nConfig';

import App from './App';
import { resolveMountTargets } from './mountTargets';

import '@/styles/base.scss';

/**
 * El nombre de montaje lo inyecta Vite desde `name` de package.json (ver
 * .vite/widgetName.ts). No hay respaldo literal a propósito: un valor por
 * defecto volvería a ser el mismo en todos los widgets creados del template, y
 * dos de ellos en una página se ocuparían los contenedores entre sí.
 */
const WIDGET_NAME = import.meta.env.VITE_WIDGET_NAME;

if (!WIDGET_NAME) {
  throw new Error(
    'Falta import.meta.env.VITE_WIDGET_NAME: el nombre de montaje lo inyecta el define de '
    + 'vite.config.ts. Si compilas fuera de la configuración del proyecto, defínelo ahí.',
  );
}

function mount() {
  const targets = resolveMountTargets(document, WIDGET_NAME);

  // El aviso también sale en producción: sin él, un widget que no encuentra su
  // contenedor no deja ningún rastro en consola.
  if (targets.length === 0) {
    console.warn(`No se encontró contenedor para el widget "${WIDGET_NAME}".`);
  }

  targets.forEach((target) => {
    target.setAttribute('data-mounted', '');
    ReactDOM.createRoot(target).render(
      <StrictMode>
        {/* Un portal se registra como 'nombre': Componente; ver «Agregar una feature» en el README. */}
        <DContextProvider availablePortals={{}}>
          <App />
        </DContextProvider>
      </StrictMode>,
    );
  });
}

// Si el script se carga en el <head>, los contenedores del <body> todavía no
// existen mientras el documento se analiza.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
