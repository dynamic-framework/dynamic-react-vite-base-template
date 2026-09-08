/**
 * Comprobación de comportamiento para la medición contrafactual de
 * framer-motion, sobre la página de .perf/widget-entry-motion.tsx.
 *
 * Por cada pieza que en Dynamic pasa por `motion` o `AnimatePresence`: abre,
 * comprueba que el contenido esté en el DOM, cierra, y comprueba que el nodo
 * del portal quede vacío. Ese último punto es el que detectaría un portal que
 * no se desmonta porque `AnimatePresence` ya no difiere el desmontaje.
 *
 * Guarda una captura de cada estado para comparar las dos celdas a ojo.
 *
 * Necesita playwright: ejecutar desde un directorio que lo tenga instalado.
 *
 * Uso: node check-motion-behaviour.mjs <url> <etiqueta> <dirCapturas> [outJson]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const URL_PAGINA = process.argv[2];
const ETIQUETA = process.argv[3];
const DIR_SHOTS = process.argv[4];
const OUT = process.argv[5];

mkdirSync(DIR_SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consola = [];
page.on('pageerror', (e) => consola.push({ tipo: 'pageerror', texto: String(e.message) }));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    consola.push({ tipo: m.type(), texto: m.text() });
  }
});

const shots = [];
async function captura(nombre) {
  const file = join(DIR_SHOTS, `${ETIQUETA}-${nombre}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
  return file;
}

/** Estado del DOM relevante en un instante. */
const estado = () => page.evaluate(() => {
  const portal = document.getElementById('d-portal');
  const q = (s) => !!document.querySelector(s);
  const n = (s) => document.querySelectorAll(s).length;
  return {
    portalHijos: portal ? portal.querySelectorAll('*').length : -1,
    backdrops: n('#d-portal .backdrop'),
    modalPresente: q('[data-testid="modal-cuerpo"]'),
    modalVisible: (() => {
      const el = document.querySelector('.modal.portal');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01;
    })(),
    modalOpacidad: (() => {
      const el = document.querySelector('.modal.portal');
      return el ? getComputedStyle(el).opacity : null;
    })(),
    modalTransform: (() => {
      const el = document.querySelector('.modal.portal');
      return el ? getComputedStyle(el).transform : null;
    })(),
    offcanvasPresente: q('[data-testid="offcanvas-cuerpo"]'),
    offcanvasTransform: (() => {
      const el = document.querySelector('.offcanvas.portal');
      return el ? getComputedStyle(el).transform : null;
    })(),
    offcanvasRectX: (() => {
      const el = document.querySelector('.offcanvas.portal');
      return el ? Math.round(el.getBoundingClientRect().x) : null;
    })(),
    confirmPresente: n('#d-portal .backdrop-confirm-modal'),
    toasts: n('[class*="toast"]'),
    alertaPresente: q('[data-testid="bloque-alerta"] .alert'),
    collapseCuerpo: q('[data-testid="collapse-cuerpo"]'),
  };
});

const pasos = [];
async function paso(nombre, accion, espera = 900) {
  if (accion) await accion();
  await page.waitForTimeout(espera);
  const e = await estado();
  const shot = await captura(nombre);
  pasos.push({ nombre, estado: e, captura: shot });
  return e;
}

await page.goto(URL_PAGINA, { waitUntil: 'load' });
await paso('01-reposo', null, 1500);

// DModal
await paso('02-modal-abierto', () => page.click('[data-testid="abrir-modal"]'));
await paso('03-modal-cerrado', () => page.click('[data-testid="modal-cerrar"]'), 1400);

// DOffcanvas
await paso('04-offcanvas-abierto', () => page.click('[data-testid="abrir-offcanvas"]'));
await paso('05-offcanvas-cerrado', () => page.click('[data-testid="offcanvas-cerrar"]'), 1400);

// DConfirmModal
await paso('06-confirm-abierto', () => page.click('[data-testid="abrir-confirm"]'));
await paso('07-confirm-cerrado', () => page.keyboard.press('Escape'), 1400);

// DToast
await paso('08-toast', () => page.click('[data-testid="lanzar-toast"]'));

// Controles sin motion
await paso('09-alerta-cerrada', async () => {
  await page.click('[data-testid="bloque-alerta"] button');
}, 600);
await paso('10-collapse-abierto', async () => {
  await page.click('[data-testid="bloque-collapse"] [role="button"], [data-testid="bloque-collapse"] button');
}, 600);

const salida = {
  etiqueta: ETIQUETA, url: URL_PAGINA, consola, pasos, capturas: shots,
};
if (OUT) writeFileSync(OUT, JSON.stringify(salida, null, 2));

console.log(`== ${ETIQUETA} ==`);
for (const p of pasos) {
  const e = p.estado;
  console.log(
    `${p.nombre.padEnd(24)} portalHijos=${String(e.portalHijos).padStart(3)} backdrops=${e.backdrops}`
    + ` modal=${e.modalPresente ? 'sí' : 'no'}(op ${e.modalOpacidad})`
    + ` offcanvas=${e.offcanvasPresente ? 'sí' : 'no'}(x ${e.offcanvasRectX})`
    + ` confirm=${e.confirmPresente} toasts=${e.toasts}`
    + ` alerta=${e.alertaPresente ? 'sí' : 'no'} collapse=${e.collapseCuerpo ? 'sí' : 'no'}`,
  );
}
console.log(`errores/avisos de consola: ${consola.length}`);
for (const c of consola.slice(0, 8)) console.log(`   [${c.tipo}] ${c.texto.slice(0, 180)}`);
await browser.close();
