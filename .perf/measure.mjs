/**
 * Medicion de runtime del baseline con Playwright + CDP.
 * Uso: node measure.mjs <baseUrl> <throttle: on|off> <runs>
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4319';
const THROTTLE = (process.argv[3] ?? 'on') === 'on';
const RUNS = Number(process.argv[4] ?? 3);
const SCENARIOS = [1, 3, 5];

// Observadores instalados antes de cualquier script de la pagina.
const INIT = `
window.__m = { lcp: 0, cls: 0, longTasks: [], inp: 0, events: [] };
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) window.__m.lcp = e.startTime;
}).observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value;
}).observe({ type: 'layout-shift', buffered: true });
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) window.__m.longTasks.push({ start: e.startTime, dur: e.duration });
}).observe({ type: 'longtask', buffered: true });
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) {
    window.__m.events.push({ name: e.name, dur: e.duration });
    if (e.duration > window.__m.inp) window.__m.inp = e.duration;
  }
}).observe({ type: 'event', durationThreshold: 16, buffered: true });
`;

const browser = await chromium.launch({
  args: ['--js-flags=--expose-gc', '--no-sandbox'],
});
const results = [];

for (const n of SCENARIOS) {
  for (let run = 1; run <= RUNS; run++) {
    const context = await browser.newContext({
      viewport: { width: 412, height: 823 },
      deviceScaleFactor: 1.75,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 '
        + '(KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36',
    });
    const page = await context.newPage();
    await page.addInitScript(INIT);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    if (THROTTLE) {
      // Equivalente a los defaults moviles de Lighthouse.
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
    }

    const t0 = Date.now();
    await page.goto(`${BASE}/perf-${n}.html`, { waitUntil: 'load' });
    // Esperar a que las N instancias hayan hecho su primer commit.
    await page.waitForFunction(
      (count) => performance.getEntriesByType('measure')
        .filter((m) => m.name.endsWith('-time-to-first-render')).length === count,
      n,
      { timeout: 120000 },
    );
    await page.waitForTimeout(1500);

    // Interaccion real para obtener INP (no proxy) en la instancia 1.
    const btn = page.locator('[data-widget-root="1"] button').first();
    await btn.click({ timeout: 30000 });
    await page.waitForTimeout(1200);
    await btn.click({ timeout: 30000 });
    await page.waitForTimeout(1200);

    const metrics = Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
    );
    await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(400);
    const heap = await cdp.send('Runtime.getHeapUsage');

    const data = await page.evaluate(() => {
      const measures = performance.getEntriesByType('measure')
        .filter((m) => m.name.endsWith('-time-to-first-render'))
        .map((m) => ({ name: m.name, start: m.startTime, dur: m.duration, end: m.startTime + m.duration }))
        .sort((a, b) => a.end - b.end);
      const nav = performance.getEntriesByType('navigation')[0];
      const paints = Object.fromEntries(
        performance.getEntriesByType('paint').map((p) => [p.name, p.startTime]),
      );
      const probes = window.__perfProbes ?? [];
      // Copias de React en memoria: identidades distintas del objeto de
      // internals del modulo React entre instancias.
      const internals = new Set(probes.map((p) => p.reactInternals));
      const modules = new Set(probes.map((p) => p.reactModule));
      const domModules = new Set(probes.map((p) => p.reactDomModule));
      const m = window.__m;
      return {
        lcp: m.lcp,
        cls: m.cls,
        inp: m.inp,
        events: m.events,
        tbt: m.longTasks.reduce((a, t) => a + Math.max(0, t.dur - 50), 0),
        longTaskCount: m.longTasks.length,
        longTaskTotal: m.longTasks.reduce((a, t) => a + t.dur, 0),
        fcp: paints['first-contentful-paint'] ?? null,
        domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
        loadEvent: nav?.loadEventEnd ?? null,
        firstRenders: measures,
        instances: probes.length,
        reactVersions: [...new Set(probes.map((p) => p.reactVersion))],
        distinctReactInternals: internals.size,
        distinctReactModules: modules.size,
        distinctReactDomModules: domModules.size,
        renderedRoots: document.querySelectorAll('[data-widget-root][data-mounted] button').length,
      };
    });

    results.push({
      scenario: n,
      run,
      throttle: THROTTLE,
      wallClockMs: Date.now() - t0,
      scriptDurationMs: (metrics.ScriptDuration ?? 0) * 1000,
      taskDurationMs: (metrics.TaskDuration ?? 0) * 1000,
      layoutDurationMs: (metrics.LayoutDuration ?? 0) * 1000,
      recalcStyleDurationMs: (metrics.RecalcStyleDuration ?? 0) * 1000,
      jsHeapUsedBytes: heap.usedSize,
      jsHeapTotalBytes: heap.totalSize,
      ...data,
    });
    console.log(
      `n=${n} run=${run} throttle=${THROTTLE} lcp=${data.lcp.toFixed(0)} `
      + `tbt=${data.tbt.toFixed(0)} inp=${data.inp.toFixed(0)} cls=${data.cls.toFixed(4)} `
      + `script=${((metrics.ScriptDuration ?? 0) * 1000).toFixed(0)}ms `
      + `heap=${(heap.usedSize / 1048576).toFixed(1)}MB `
      + `reactCopies=${data.distinctReactInternals}/${data.instances} roots=${data.renderedRoots}`,
    );
    await context.close();
  }
}

await browser.close();
const out = `results-${THROTTLE ? 'throttled' : 'unthrottled'}.json`;
writeFileSync(new URL(out, import.meta.url), JSON.stringify(results, null, 2));
console.log('escrito', out);
