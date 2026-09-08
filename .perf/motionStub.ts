import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

/**
 * PLUGIN DE PRUEBA — solo para la medición contrafactual de framer-motion.
 * No es parte del template: vive en .perf/, no en .vite/plugins/, y no está
 * registrado en vite.config.ts.
 *
 * Sustituye `framer-motion` por un módulo virtual mínimo, SOLO cuando quien lo
 * importa vive dentro de node_modules/@dynamic-framework/ui-react/. Un widget
 * que importe framer-motion por su cuenta sigue viendo el paquete real.
 *
 * Inventario que cubre (dist/esm de 2.10-preview): cuatro módulos importan
 * framer-motion y entre todos usan exactamente dos símbolos en runtime,
 * `motion` (siempre `motion.div`) y `AnimatePresence`. No hay ningún hook de
 * motion (useAnimation, useMotionValue, useTransform, useScroll, useSpring,
 * useInView), ni `layout`/`layoutId`, ni `drag`, ni `whileHover`/`whileTap`, ni
 * `onExitComplete`.
 *
 * QUÉ SE PIERDE CON CADA SUSTITUCIÓN
 *
 * `motion.<tag>` -> el elemento HTML equivalente, descartando las props de
 *   animación (initial, animate, exit, transition, variants, custom, layout,
 *   whileHover, whileTap, drag y compañía). El elemento se monta directamente
 *   en su estado final, sin interpolación:
 *     - DPortalContext: el backdrop aparece y desaparece de golpe en vez de
 *       hacer fade a opacity 0.5 en 150 ms. Ojo: el `animate={{opacity:0.5}}`
 *       era lo que le daba la opacidad; sin la prop, la opacidad la decide el
 *       CSS de la clase `.backdrop`.
 *     - DModal: sin fade + scale 0.95 -> 1 al abrir ni a la inversa al cerrar.
 *     - DOffcanvas: sin desplazamiento desde el borde. Sus variantes son una
 *       función resuelta por `custom` (`hidden: (openFrom) => ({x:'-100%'}))`),
 *       así que al descartarlas el panel no recibe ningún transform y queda
 *       donde lo ponga el CSS de `.offcanvas.show`.
 *     - DConfirmModalContainer: sin fade del contenedor.
 *   `style` sí se pasa tal cual: en este dist nunca contiene MotionValues.
 *
 * `AnimatePresence` -> un Fragment que renderiza sus children. Se pierde el
 *   diferido del desmontaje: los `exit` no se ejecutan y React desmonta al
 *   instante. Nada del dist usa `onExitComplete`, así que no hay callback que
 *   deje de dispararse; el riesgo teórico de un portal que no se desmonta no
 *   aplica por construcción, pero se verifica en navegador de todas formas.
 *   Se pierde también el `exit` con `transition: { delay: 0.3 }` del backdrop,
 *   que hoy hace que el backdrop sobreviva 300 ms al contenido.
 *
 * Resto de símbolos -> no-ops defensivos. El inventario dice que no se usan;
 *   están para que un import inesperado falle de forma visible en la consola
 *   en vez de romper el montaje en silencio.
 *
 * Los tipos (`Transition`, `Variants`) desaparecen en el dist, así que el stub
 * no necesita cubrirlos. Sí importa para la API pública: `DModal` y
 * `DOffcanvas` exponen `transition?: Transition`, una prop cuyo tipo viene de
 * framer-motion. Con el stub la prop se acepta y se ignora.
 */

const VIRTUAL_ID = 'virtual:motion-stub';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const SPECIFIER = 'framer-motion';

export type MotionStubOptions = { disabled?: boolean };

function uiReactDir(root: string): string {
  const pkg = createRequire(path.join(root, 'package.json'))
    .resolve('@dynamic-framework/ui-react/package.json');
  return path.dirname(pkg);
}

/** El módulo virtual, en JS plano: sin JSX, para no depender del pipeline. */
const STUB_SOURCE = `
// Generado por .perf/motionStub.ts — stub contrafactual de framer-motion.
import { createElement, forwardRef, Fragment } from 'react';

/** Props de animación que el stub descarta antes de tocar el DOM. */
const DROP = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants', 'custom',
  'layout', 'layoutId', 'layoutDependency', 'layoutScroll', 'layoutRoot',
  'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView',
  'drag', 'dragConstraints', 'dragElastic', 'dragMomentum', 'dragPropagation',
  'dragControls', 'dragListener', 'dragSnapToOrigin', 'dragTransition',
  'viewport', 'inherit', 'transformTemplate', 'transformValues',
  'onAnimationStart', 'onAnimationComplete', 'onUpdate',
  'onDrag', 'onDragStart', 'onDragEnd', 'onDirectionLock',
  'onHoverStart', 'onHoverEnd', 'onTap', 'onTapStart', 'onTapCancel',
  'onViewportEnter', 'onViewportLeave', 'onBeforeLayoutMeasure',
  'onLayoutMeasure', 'onLayoutAnimationStart', 'onLayoutAnimationComplete',
]);

function strip(props) {
  const out = {};
  for (const key in props) {
    if (!DROP.has(key)) out[key] = props[key];
  }
  return out;
}

const cache = new Map();
function stubFor(tag) {
  if (cache.has(tag)) return cache.get(tag);
  const Component = forwardRef(function MotionStub(props, ref) {
    const clean = strip(props);
    if (ref) clean.ref = ref;
    return createElement(tag, clean);
  });
  Component.displayName = typeof tag === 'string'
    ? 'motion.' + tag
    : 'motion(Component)';
  cache.set(tag, Component);
  return Component;
}

/**
 * \`motion\` acepta las dos formas: \`motion.div\` (acceso a propiedad) y
 * \`motion(MiComponente)\` (llamada). El Proxy va sobre una función para poder
 * atender \`apply\` además de \`get\`.
 */
export const motion = new Proxy(function motionFactory() {}, {
  get(_target, tag) {
    if (typeof tag !== 'string') return undefined;
    return stubFor(tag);
  },
  apply(_target, _thisArg, args) {
    return stubFor(args[0]);
  },
});

/** Renderiza los children sin diferir el desmontaje. */
export function AnimatePresence(props) {
  return createElement(Fragment, null, props.children);
}

/** Alias abreviado de \`motion\` en framer-motion. */
export const m = motion;

// --- No-ops defensivos: el inventario dice que el dist no los usa. ---
const aviso = (nombre) => {
  // eslint-disable-next-line no-console
  console.warn('[motion-stub] se usó ' + nombre + ', que el stub no implementa');
};
export const LayoutGroup = AnimatePresence;
export const MotionConfig = AnimatePresence;
export const useAnimation = () => { aviso('useAnimation'); return { start: () => Promise.resolve(), stop: () => {}, set: () => {} }; };
export const useAnimate = () => { aviso('useAnimate'); return [() => {}, () => Promise.resolve()]; };
export const useMotionValue = (initial) => { aviso('useMotionValue'); return { get: () => initial, set: () => {}, on: () => () => {} }; };
export const useTransform = () => { aviso('useTransform'); return useMotionValue(0); };
export const useSpring = () => { aviso('useSpring'); return useMotionValue(0); };
export const useScroll = () => { aviso('useScroll'); return { scrollX: useMotionValue(0), scrollY: useMotionValue(0) }; };
export const useInView = () => { aviso('useInView'); return false; };
export const useReducedMotion = () => false;
export const animate = () => { aviso('animate'); return { stop: () => {}, then: (f) => Promise.resolve().then(f) }; };
export const AnimateSharedLayout = AnimatePresence;
`;

export default function motionStub(options: MotionStubOptions = {}): Plugin {
  const { disabled = false } = options;
  let root = process.cwd();

  return {
    name: 'motion-stub',
    apply: 'build',
    // vite:resolve tambien responde a 'framer-motion' y en resolveId gana el
    // primero que contesta.
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    resolveId(source, importer) {
      if (disabled) return null;
      if (source !== SPECIFIER || !importer) return null;
      const dir = uiReactDir(root);
      if (!fs.existsSync(dir)) return null;
      const normalized = importer.split(path.sep).join('/');
      const prefix = `${dir.split(path.sep).join('/')}/`;
      if (!normalized.startsWith(prefix)) return null;
      return RESOLVED_VIRTUAL_ID;
    },

    load(id) {
      if (disabled || id !== RESOLVED_VIRTUAL_ID) return null;
      return STUB_SOURCE;
    },
  };
}
