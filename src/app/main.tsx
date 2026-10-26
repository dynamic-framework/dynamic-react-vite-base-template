import { DContextProvider } from '@dynamic-framework/ui-react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import '@/config/i18nConfig';
import { EntityCreateModal, type EntityPortals } from '@/features/entities';

import App from './App';
import { resolveMountTargets } from './mountTargets';

import '@/styles/base.scss';

const WIDGET_NAME = 'widgetName';

function mount() {
  const targets = resolveMountTargets(document, WIDGET_NAME);

  if (targets.length === 0 && import.meta.env.DEV) {
    console.warn(`No se encontró contenedor para el widget "${WIDGET_NAME}".`);
  }

  targets.forEach((target) => {
    target.setAttribute('data-mounted', '');
    ReactDOM.createRoot(target).render(
      <StrictMode>
        <DContextProvider<EntityPortals>
          availablePortals={{ 'entity-create': EntityCreateModal }}
        >
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
