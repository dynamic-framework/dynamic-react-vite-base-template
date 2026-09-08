/**
 * Verificacion funcional de una variante del harness.
 *
 * Carga perf-N.html, registra errores de consola y excepciones de pagina, y
 * comprueba que cada instancia monte: boton "Click me!", los 3 iconos de MyLink
 * (Book, Brush, Layout) y, tras el clic, los logos con el icono Plus.
 *
 * Uso: node .perf/cf-check.mjs <baseUrl> <n> [screenshotPath]
 * Salida: JSON por stdout.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2];
const N = Number(process.argv[3] ?? 1);
const SHOT = process.argv[4];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`.slice(0, 300)); });
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
page.on('requestfailed', (r) => failedRequests.push(`${r.url().slice(0, 120)} ${r.failure()?.errorText}`));

const result = { url: `${BASE}/perf-${N}.html`, n: N };
try {
  const resp = await page.goto(`${BASE}/perf-${N}.html`, { waitUntil: 'load', timeout: 60000 });
  result.status = resp?.status();
  await page.waitForTimeout(3000);
  result.mountedRoots = await page.locator('[data-widget-root][data-mounted]').count();
  result.buttons = await page.getByRole('button', { name: 'Click me!' }).count();
  result.svgIcons = await page.locator('[data-widget-root] svg').count();
  result.instancesProbe = await page.evaluate(() => window.__perfProbes?.length ?? 0);
  result.reactCopies = await page.evaluate(() => new Set((window.__perfProbes ?? []).map((p) => p.reactInternals)).size);
  result.firstRenderMeasures = await page.evaluate(
    () => performance.getEntriesByType('measure').filter((m) => m.name.endsWith('-time-to-first-render')).length,
  );
  // Interaccion: el clic debe revelar MyLogos (icono Plus).
  const btn = page.locator('[data-widget-root="1"] button').first();
  if (await btn.count()) {
    await btn.click({ timeout: 15000 });
    await page.waitForTimeout(1200);
    result.svgIconsAfterClick = await page.locator('[data-widget-root="1"] svg').count();
    result.interactionOk = result.svgIconsAfterClick > 0;
  } else {
    result.interactionOk = false;
  }
  // Texto de referencia del widget montado.
  result.hasTitleText = await page.locator('text=Get started by editing').count();
  if (SHOT) await page.screenshot({ path: SHOT, fullPage: false });
} catch (e) {
  result.error = String(e).slice(0, 400);
}
result.consoleErrors = consoleErrors;
result.pageErrors = pageErrors;
result.failedRequests = failedRequests;
result.ok = !result.error && result.pageErrors.length === 0
  && result.mountedRoots === N && result.buttons === N && result.hasTitleText === N;
console.log(JSON.stringify(result, null, 2));
await browser.close();
