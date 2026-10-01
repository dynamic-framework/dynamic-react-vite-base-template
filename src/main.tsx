import { DContextProvider } from '@dynamic-framework/ui-react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import './config/i18nConfig';

import App from './App';
import { resolveMountTargets } from './utils/mountTargets';

// Comenta o elimina esta línea si tu sitio de Modyo ya carga el CSS de Dynamic UI; de lo contrario se cargará dos veces y puede causar problemas de estilos.
import '@dynamic-framework/ui-react/dist/css/dynamic-ui.css';
import './styles/base.scss';

const WIDGET_NAME = 'widgetName';

const targets = resolveMountTargets(document, WIDGET_NAME);

if (targets.length === 0 && import.meta.env.DEV) {
  console.warn(`No se encontró contenedor para el widget "${WIDGET_NAME}".`);
}

targets.forEach((target) => {
  target.setAttribute('data-mounted', '');
  ReactDOM.createRoot(target).render(
    <StrictMode>
      <DContextProvider>
        <App />
      </DContextProvider>
    </StrictMode>,
  );
});
