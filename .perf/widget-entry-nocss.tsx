/**
 * Entry de medición para el baseline (rama perf/baseline-v1.2.0).
 *
 * Replica exactamente el grafo de imports de src/main.tsx (DContextProvider +
 * i18nConfig + App + CSS de Dynamic + base.scss). Las dos únicas diferencias,
 * ambas necesarias para poder montar N instancias independientes en una misma
 * página, son:
 *
 *  1. El contenedor se resuelve en runtime (el primer [data-widget-root] libre)
 *     en vez de estar fijo en #widgetName.
 *  2. Instrumentación: marca de primer commit por instancia y sonda de
 *     identidad del módulo React, para contar copias en memoria.
 */
import { DContextProvider } from '@dynamic-framework/ui-react';
import React, { StrictMode, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom/client';

import '../src/config/i18nConfig';

import App from '../src/App';

// [contrafactual C] CSS de Dynamic NO empaquetado: se carga como <link> desde el CDN.
import '../src/styles/base.scss';

declare global {
  interface Window {
    __perfProbes?: Array<{
      slot: number;
      reactVersion: string;
      reactInternals: unknown;
      reactModule: unknown;
      reactDomModule: unknown;
    }>;
  }
}

const container = document.querySelector<HTMLElement>('[data-widget-root]:not([data-mounted])');
if (!container) {
  throw new Error('[perf] no hay contenedor [data-widget-root] libre');
}
container.dataset.mounted = 'true';
const slot = Number(container.dataset.widgetRoot);

// Sonda de identidad: si dos instancias comparten el mismo objeto de internals,
// comparten la misma copia del módulo React.
window.__perfProbes = window.__perfProbes ?? [];
window.__perfProbes.push({
  slot,
  reactVersion: React.version,
  reactInternals: (React as unknown as Record<string, unknown>)
    .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  reactModule: React,
  reactDomModule: ReactDOM,
});

performance.mark(`widget-${slot}-mount-start`);

function FirstRenderMark({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    performance.mark(`widget-${slot}-first-render`);
    performance.measure(
      `widget-${slot}-time-to-first-render`,
      `widget-${slot}-mount-start`,
      `widget-${slot}-first-render`,
    );
  }, []);
  return children;
}

const root = ReactDOM.createRoot(container);
root.render(
  <StrictMode>
    <FirstRenderMark>
      <DContextProvider>
        <App />
      </DContextProvider>
    </FirstRenderMark>
  </StrictMode>,
);
