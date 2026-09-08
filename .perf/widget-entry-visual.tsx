/**
 * Variante del entry del harness para la verificacion visual de iconos.
 *
 * Monta el mismo App del widget de referencia (que pinta Book, Brush y Layout
 * a traves de MyLink) y le agrega un DAlert cerrable, cuyos dos iconos (Info y
 * la X de cerrar) los resuelve Dynamic por dentro sin que el widget declare
 * nada. Sirve para comprobar en navegador que en cada celda de la medicion se
 * pintan las dos clases de icono.
 *
 * No forma parte de la medicion de tamano ni de Lighthouse: esos usan
 * .perf/widget-entry.tsx sin modificar.
 */
import { DAlert, DContextProvider } from '@dynamic-framework/ui-react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import '../src/config/i18nConfig';

import App from '../src/App';

import '@dynamic-framework/ui-react/dist/css/dynamic-ui.css';
import '../src/styles/base.scss';

const container = document.querySelector<HTMLElement>('[data-widget-root]:not([data-mounted])');
if (!container) {
  throw new Error('[perf] no hay contenedor [data-widget-root] libre');
}
container.dataset.mounted = 'true';

const root = ReactDOM.createRoot(container);
root.render(
  <StrictMode>
    <DContextProvider>
      <div data-testid="alert-probe">
        <DAlert color="info" showClose onClose={() => {}}>
          Alerta cerrable: sus iconos los resuelve Dynamic por dentro.
        </DAlert>
      </div>
      <App />
    </DContextProvider>
  </StrictMode>,
);
