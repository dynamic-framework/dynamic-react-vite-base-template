/**
 * Carga la pagina del harness con N instancias y reporta cualquier mensaje de
 * consola de nivel error/warning, errores de pagina y respuestas HTTP fallidas.
 * Uso: node .perf/console-check.mjs <baseUrl> <instancias>
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4320';
const N = Number(process.argv[3] ?? 1);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true,
});
const page = await context.newPage();
const errors = [];
const warnings = [];
const pageErrors = [];
const badResponses = [];
page.on('console', (m) => {
  const entry = { type: m.type(), text: m.text(), loc: m.location() };
  if (m.type() === 'error') errors.push(entry);
  else if (m.type() === 'warning') warnings.push(entry);
});
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

await page.goto(`${BASE}/perf-${N}.html`, { waitUntil: 'load' });
await page.waitForFunction(
  (count) => performance.getEntriesByType('measure')
    .filter((m) => m.name.endsWith('-time-to-first-render')).length === count,
  N,
  { timeout: 60000 },
);
await page.waitForTimeout(1500);

const dom = await page.evaluate(() => ({
  roots: document.querySelectorAll('[data-widget-root]').length,
  mounted: document.querySelectorAll('[data-widget-root][data-mounted]').length,
  buttons: document.querySelectorAll('[data-widget-root] button').length,
  svgs: document.querySelectorAll('[data-widget-root] svg').length,
  textSample: (document.querySelector('[data-widget-root]')?.innerText ?? '').slice(0, 120).replace(/\s+/g, ' '),
}));

// Interaccion real para verificar que el widget responde.
const btn = page.locator('[data-widget-root="1"] button').first();
await btn.click({ timeout: 20000 });
await page.waitForTimeout(800);
const afterClick = await page.evaluate(() => (document.querySelector('[data-widget-root]')?.innerText ?? '').slice(0, 160).replace(/\s+/g, ' '));

console.log('DOM:', JSON.stringify(dom, null, 2));
console.log('texto tras click:', afterClick);
console.log('errores de consola:', errors.length);
errors.forEach((e) => console.log('  ERROR:', e.text));
console.log('warnings de consola:', warnings.length);
warnings.forEach((e) => console.log('  WARN:', e.text));
console.log('excepciones de pagina:', pageErrors.length);
pageErrors.forEach((e) => console.log('  PAGEERROR:', e));
console.log('respuestas HTTP >=400:', badResponses.length);
badResponses.forEach((r) => console.log('  ', r));
await browser.close();
process.exit(errors.length + pageErrors.length + badResponses.length > 0 ? 1 : 0);
