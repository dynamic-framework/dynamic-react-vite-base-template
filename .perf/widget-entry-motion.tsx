/**
 * Entry de comportamiento para la medición contrafactual de framer-motion.
 *
 * Monta todo lo que en Dynamic pasa por `motion` o `AnimatePresence`, con un
 * disparador por cada uno, para poder comprobar en navegador que con el stub
 * cada pieza abre, muestra su contenido y cierra:
 *
 *  - DModal y DOffcanvas, que son portales: se abren con `openPortal` del
 *    DPortalContext, que es la vía estructural (`AnimatePresence` + el backdrop
 *    animado viven ahí).
 *  - DConfirmModal, por `useConfirmModal().open()`, que tiene su propio
 *    `AnimatePresence` en DConfirmModalContainer.
 *  - DAlert cerrable y DCollapse, que NO usan motion: son el control de que el
 *    resto de la interfaz no se ve afectada.
 *  - Un DToast, que tampoco usa motion (lo anima react-hot-toast).
 *
 * Ojo con el toast: `useDToast` importa react-hot-toast, que en la celda (3)
 * del bundle real está ausente. Montarlo aquí lo mete en el bundle, así que
 * este entry NO sirve para medir bytes; para eso está widget-entry.tsx.
 *
 * No se usa en la medición de tamaños ni de Lighthouse.
 */
import {
  DAlert,
  DButton,
  DCollapse,
  DConfirmModalContainer,
  DContextProvider,
  DModal,
  DOffcanvas,
  DToastContainer,
  useConfirmModal,
  useDPortalContext,
  useDToast,
} from '@dynamic-framework/ui-react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

import '../src/config/i18nConfig';

import '@dynamic-framework/ui-react/dist/css/dynamic-ui.css';
import '../src/styles/base.scss';

type Payloads = {
  modal: { titulo: string };
  offcanvas: { titulo: string };
};

function ModalPortal({ payload }: { name: string; payload: Payloads['modal'] }) {
  const { closePortal } = useDPortalContext<Payloads>();
  return (
    <DModal name="modalPrueba" centered>
      <DModal.Header onClose={closePortal}>
        <h5 className="modal-title" data-testid="modal-titulo">{payload.titulo}</h5>
      </DModal.Header>
      <DModal.Body>
        <p data-testid="modal-cuerpo">Cuerpo del modal.</p>
      </DModal.Body>
      <DModal.Footer>
        <DButton text="Cerrar modal" onClick={closePortal} dataAttributes={{ 'data-testid': 'modal-cerrar' }} />
      </DModal.Footer>
    </DModal>
  );
}

function OffcanvasPortal({ payload }: { name: string; payload: Payloads['offcanvas'] }) {
  const { closePortal } = useDPortalContext<Payloads>();
  return (
    <DOffcanvas name="offcanvasPrueba" openFrom="end">
      <DOffcanvas.Header onClose={closePortal}>
        <h5 data-testid="offcanvas-titulo">{payload.titulo}</h5>
      </DOffcanvas.Header>
      <DOffcanvas.Body>
        <p data-testid="offcanvas-cuerpo">Cuerpo del offcanvas.</p>
      </DOffcanvas.Body>
      <DOffcanvas.Footer>
        <DButton text="Cerrar offcanvas" onClick={closePortal} dataAttributes={{ 'data-testid': 'offcanvas-cerrar' }} />
      </DOffcanvas.Footer>
    </DOffcanvas>
  );
}

function Panel() {
  const { openPortal } = useDPortalContext<Payloads>();
  const { toast } = useDToast();
  const [alertaVisible, setAlertaVisible] = useState(true);
  const confirmar = useConfirmModal({
    title: 'Confirmar acción',
    message: '¿Seguro que quieres continuar?',
    onConfirm: () => {},
  });

  return (
    <div className="container py-4 d-flex flex-column gap-3">
      <div className="d-flex flex-wrap gap-2">
        <DButton
          text="Abrir modal"
          onClick={() => openPortal('modal', { titulo: 'Modal de prueba' })}
          dataAttributes={{ 'data-testid': 'abrir-modal' }}
        />
        <DButton
          text="Abrir offcanvas"
          onClick={() => openPortal('offcanvas', { titulo: 'Offcanvas de prueba' })}
          dataAttributes={{ 'data-testid': 'abrir-offcanvas' }}
        />
        <DButton
          text="Abrir confirm"
          onClick={() => confirmar.open()}
          dataAttributes={{ 'data-testid': 'abrir-confirm' }}
        />
        <DButton
          text="Lanzar toast"
          onClick={() => toast({ title: 'Toast de prueba', description: 'Texto del toast' })}
          dataAttributes={{ 'data-testid': 'lanzar-toast' }}
        />
      </div>

      <div data-testid="bloque-alerta">
        {alertaVisible && (
          <DAlert color="info" showClose onClose={() => setAlertaVisible(false)}>
            Alerta cerrable — no usa motion.
          </DAlert>
        )}
      </div>

      <div data-testid="bloque-collapse">
        <DCollapse Component={<span>Desplegable</span>} defaultCollapsed>
          <p className="mb-0" data-testid="collapse-cuerpo">Contenido del collapse.</p>
        </DCollapse>
      </div>
    </div>
  );
}

const container = document.querySelector<HTMLElement>('[data-widget-root]:not([data-mounted])');
if (!container) {
  throw new Error('[perf] no hay contenedor [data-widget-root] libre');
}
container.dataset.mounted = 'true';

const root = ReactDOM.createRoot(container);
root.render(
  <DContextProvider<Payloads>
    portalName="d-portal"
    availablePortals={{ modal: ModalPortal, offcanvas: OffcanvasPortal }}
  >
    <Panel />
    <DConfirmModalContainer nodeId="d-portal" />
    <DToastContainer />
  </DContextProvider>,
);
