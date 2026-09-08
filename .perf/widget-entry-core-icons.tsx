/**
 * Entry de verificacion visual de iconos.
 *
 * Monta, dentro de un unico DContextProvider:
 *
 *  1. Una rejilla con los 27 nombres del nucleo mas los 3 del widget, cada uno
 *     por DIcon. Es la comprobacion definitiva de resolucion: si el nombre no
 *     esta en el bundle, DIconBase cae al fallback <i class="bi bi-Nombre"> y
 *     no se pinta nada.
 *  2. Los componentes reales de Dynamic que eligen un icono del nucleo por su
 *     cuenta, en el estado que lo muestra. El mapa componente -> icono se
 *     derivo de src/icons/coreIcons.ts y src/contexts/DContext.tsx de
 *     dynamic-ui (rama feat/icon-registry-core), en solo lectura.
 *  3. Los tres iconos del widget de referencia por MyLink.
 *  4. Un icono propio registrado por el consumidor con iconRegistry (#1177),
 *     que es un SVG en linea y no un nombre de Lucide.
 *  5. Un nombre inexistente, para ver el fallback.
 *
 * No se usa para medir bytes ni Lighthouse: eso sale de widget-entry.tsx.
 */
import {
  DAlert,
  DBoxFile,
  DChip,
  DCollapse,
  DContextProvider,
  DDataStateWrapper,
  DDatePicker,
  DDropdown,
  DIcon,
  DInput,
  DInputCounter,
  DInputPassword,
  DPasswordStrengthMeter,
  DStepper,
  DVoucher,
} from '@dynamic-framework/ui-react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import '../src/config/i18nConfig';

import MyLink from '../src/components/MyLink';

import '@dynamic-framework/ui-react/dist/css/dynamic-ui.css';
import '../src/styles/base.scss';

/** Los 27 del nucleo, en el orden de dist/icons-core.json. */
const CORE = [
  'AlertCircle', 'AlertTriangle', 'Calendar', 'Check', 'CheckCircle',
  'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp', 'Eye', 'EyeOff',
  'Info', 'Minus', 'Plus', 'Search', 'Upload', 'X', 'Circle', 'CircleCheck',
  'CircleCheckBig', 'Download', 'FileText', 'MoreVertical', 'Paperclip',
  'RefreshCw', 'Share2', 'Trash',
];

/** Los tres que aporta el widget de referencia por su codigo. */
const WIDGET = ['Book', 'Brush', 'Layout'];

/**
 * Icono propio del consumidor: un SVG en linea, no un nombre de Lucide.
 * DIconBase lo recibe por iconRegistry y lo renderiza con createElement,
 * pasandole width / height / strokeWidth.
 */
function RayoPropio({ width = 24, height = 24, strokeWidth = 2 }: {
  width?: number | string;
  height?: number | string;
  strokeWidth?: number;
}) {
  return (
    <svg
      data-testid="svg-registrado"
      className="icono-registrado"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

const ICON_REGISTRY = { RayoPropio };

function Bloque({ id, titulo, children }: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section data-comp={id} className="border rounded p-3 mb-3">
      <h6 className="text-muted mb-3">{titulo}</h6>
      {children}
    </section>
  );
}

function CoreIcons() {
  return (
    <div className="d-flex flex-wrap gap-3">
      {[...CORE, ...WIDGET].map((name) => (
        <div key={name} data-icon={name} className="text-center" style={{ width: 96 }}>
          <DIcon icon={name} size="1.5rem" />
          <div className="small text-muted">{name}</div>
        </div>
      ))}
    </div>
  );
}

export default function CoreIconsPage() {
  return (
    <div className="container py-4 d-flex flex-column gap-2">
      <Bloque id="rejilla-dicon" titulo="1. Los 30 nombres por DIcon">
        <CoreIcons />
      </Bloque>

      <Bloque id="dalert" titulo="2. DAlert — los cuatro colores, con showClose (AlertCircle, AlertTriangle, CheckCircle, Info, X)">
        {(['warning', 'danger', 'success', 'info'] as const).map((color) => (
          <div key={color} data-alert={color}>
            <DAlert color={color} showClose onClose={() => {}}>
              {`Alerta ${color}`}
            </DAlert>
          </div>
        ))}
      </Bloque>

      <Bloque id="dcollapse" titulo="3. DCollapse — abierto y cerrado (ChevronUp, ChevronDown)">
        <div data-collapse="abierto">
          <DCollapse Component={<span>Abierto</span>} defaultCollapsed={false}>
            <p className="mb-0">Contenido visible.</p>
          </DCollapse>
        </div>
        <div data-collapse="cerrado">
          <DCollapse Component={<span>Cerrado</span>} defaultCollapsed>
            <p className="mb-0">Contenido oculto.</p>
          </DCollapse>
        </div>
      </Bloque>

      <Bloque id="dinputpassword" titulo="4. DInputPassword (Eye / EyeOff segun el estado)">
        <DInputPassword label="Contrasena" value="secreto" onChange={() => {}} />
      </Bloque>

      <Bloque id="dinputcounter" titulo="5. DInputCounter (Plus, Minus)">
        <DInputCounter label="Cantidad" value={2} minValue={0} maxValue={9} onChange={() => {}} />
      </Bloque>

      <Bloque id="dinput-search" titulo="6. DInput con iconStart=Search (Search no lo pinta ningun componente por si solo)">
        <DInput label="Buscar" iconStart="Search" value="" onChange={() => {}} />
      </Bloque>

      <Bloque id="ddatepicker" titulo="7. DDatePicker inline y abierto (Calendar en el input, ChevronLeft / ChevronRight en la cabecera)">
        <DDatePicker inputLabel="Fecha" showHeaderSelectors selected={new Date(2026, 8, 8)} onChange={() => {}} />
        <div className="mt-3">
          <DDatePicker inline showHeaderSelectors selected={new Date(2026, 8, 8)} onChange={() => {}} />
        </div>
      </Bloque>

      <Bloque id="dboxfile" titulo="8. DBoxFile (Upload; Paperclip y Trash solo con un archivo cargado)">
        <DBoxFile
          accept={{ 'image/png': ['.png'], 'image/svg+xml': ['.svg'] }}
          multiple
          maxFiles={3}
        />
      </Bloque>

      <Bloque id="dvoucher" titulo="9. DVoucher (Share2, Download, CircleCheckBig por defecto)">
        {/*
          El default CircleCheckBig solo aplica si `icon` llega como objeto
          parcial: DVoucher.js hace `if (icon === false || icon == null) return
          null`, asi que omitir la prop deja el voucher SIN icono de cabecera.
        */}
        <DVoucher title="Comprobante" message="Operacion exitosa" amount="$ 1.000" icon={{}} />
      </Bloque>

      <Bloque id="ddropdown" titulo="10. DDropdown — toggle por defecto (MoreVertical)">
        <DDropdown actions={[{ label: 'Una accion', onClick: () => {} }]} />
      </Bloque>

      <Bloque id="dstepper" titulo="11. DStepper completado (Check)">
        <DStepper
          breakpoint="xs"
          completed
          currentStep={2}
          options={[
            { label: 'Uno', value: 0 },
            { label: 'Dos', value: 1 },
            { label: 'Tres', value: 2 },
          ]}
        />
      </Bloque>

      <Bloque id="dpasswordstrengthmeter" titulo="12. DPasswordStrengthMeter (CircleCheck cumplido, Circle pendiente)">
        <DPasswordStrengthMeter value="Abc1" onChange={() => {}} />
      </Bloque>

      <Bloque id="ddatastatewrapper-error" titulo="13. DDataStateWrapper en error con onRetry (RefreshCw)">
        <DDataStateWrapper isLoading={false} isError data={undefined} onRetry={() => {}}>
          {() => <span>nunca</span>}
        </DDataStateWrapper>
      </Bloque>

      <Bloque id="ddatastatewrapper-empty" titulo="14. DDataStateWrapper vacio (FileText)">
        <DDataStateWrapper isLoading={false} isError={false} data={[]}>
          {() => <span>nunca</span>}
        </DDataStateWrapper>
      </Bloque>

      <Bloque id="dchip" titulo="15. DChip con showClose (X)">
        <DChip color="primary" text="Etiqueta" showClose onClose={() => {}} />
      </Bloque>

      <Bloque id="mylink" titulo="16. Los tres iconos del widget por MyLink (Book, Brush, Layout)">
        <div className="row">
          <div className="col"><MyLink href="#" icon="Book" title="Book" description="Book" /></div>
          <div className="col"><MyLink href="#" icon="Brush" title="Brush" description="Brush" /></div>
          <div className="col"><MyLink href="#" icon="Layout" title="Layout" description="Layout" /></div>
        </div>
      </Bloque>

      <Bloque id="registro" titulo="17. Icono propio del consumidor por iconRegistry (SVG en linea, no Lucide)">
        <div data-icon-registrado="RayoPropio">
          <DIcon icon="RayoPropio" size="2rem" />
        </div>
      </Bloque>

      <Bloque id="inexistente" titulo="18. Nombre inexistente: NoExiste">
        <div data-icon-inexistente="NoExiste">
          <DIcon icon="NoExiste" size="2rem" />
        </div>
      </Bloque>
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
  <StrictMode>
    <DContextProvider iconRegistry={ICON_REGISTRY}>
      <CoreIconsPage />
    </DContextProvider>
  </StrictMode>,
);
