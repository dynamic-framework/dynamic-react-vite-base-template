import { DContextProvider } from '@dynamic-framework/ui-react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import './config/i18nConfig';

import App from './App';
import { resolveMountTargets } from './utils/mountTargets';

// Solo los estilos propios del widget. El CSS de Dynamic UI y el theme los
// carga el sitio de Modyo una vez para toda la pagina: importarlos aqui metia
// 1,2 MB en dist/main.css y redeclaraba :root, pisando los tokens del theme.
// Para desarrollo local se enlazan desde index.html. Ver el README.
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
