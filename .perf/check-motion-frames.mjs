/**
 * Muestreo de fotogramas para la medición contrafactual de framer-motion.
 *
 * El DOM final es igual con y sin motion; la diferencia está en los
 * fotogramas intermedios y en las propiedades que `animate` fijaba por estilo
 * en línea. Este script abre el modal y el offcanvas y muestrea opacidad,
 * transform y posición a intervalos cortos, además de guardar una captura del
 * primer fotograma.
 *
 * Uso: node check-motion-frames.mjs <url> <etiqueta> <dirCapturas> [outJson]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [URL_PAGINA, ETIQUETA, DIR_SHOTS, OUT] = process.argv.slice(2);
mkdirSync(DIR_SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consola = [];
page.on('pageerror', (e) => consola.push(String(e.message)));
await page.goto(URL_PAGINA, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const leer = () => page.evaluate(() => {
  const cs = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      opacity: s.opacity,
      transform: s.transform,
      x: Math.round(el.getBoundingClientRect().x),
      inlineStyle: el.getAttribute('style'),
    };
  };
  return {
    modal: cs('.modal.portal'),
    backdrop: cs('#d-portal .backdrop'),
    offcanvas: cs('.offcanvas.portal'),
  };
});

async function muestrear(nombre, selectorBoton, tiempos) {
  const serie = [];
  await page.click(selectorBoton);
  for (const t of tiempos) {
    await page.waitForTimeout(t.delta);
    serie.push({ ms: t.ms, ...(await leer()) });
    if (t.captura) {
      await page.screenshot({ path: join(DIR_SHOTS, `${ETIQUETA}-${nombre}-${t.ms}ms.png`) });
    }
  }
  return serie;
}

const tiempos = [
  { ms: 30, delta: 30, captura: true },
  { ms: 80, delta: 50, captura: true },
  { ms: 160, delta: 80, captura: false },
  { ms: 320, delta: 160, captura: false },
  { ms: 900, delta: 580, captura: true },
];

const modal = await muestrear('modal', '[data-testid="abrir-modal"]', tiempos);
await page.click('[data-testid="modal-cerrar"]');
await page.waitForTimeout(1400);
const offcanvas = await muestrear('offcanvas', '[data-testid="abrir-offcanvas"]', tiempos);

const salida = { etiqueta: ETIQUETA, modal, offcanvas, consola };
if (OUT) writeFileSync(OUT, JSON.stringify(salida, null, 2));

const fmt = (o) => (o ? `op=${o.opacity} x=${o.x} tf=${String(o.transform).slice(0, 32)}` : '(ausente)');
console.log(`== ${ETIQUETA} ==`);
console.log('-- modal --');
for (const s of modal) console.log(`  ${String(s.ms).padStart(4)}ms  modal[${fmt(s.modal)}]  backdrop[${fmt(s.backdrop)}]`);
console.log('-- offcanvas --');
for (const s of offcanvas) console.log(`  ${String(s.ms).padStart(4)}ms  offcanvas[${fmt(s.offcanvas)}]  backdrop[${fmt(s.backdrop)}]`);
console.log(`errores: ${consola.length}`);
await browser.close();
