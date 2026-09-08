/**
 * Lighthouse movil sobre varias variantes, intercaladas y con calentamiento.
 *
 * Diferencias con m-lh-interleaved.mjs:
 *  - Hace una ronda de calentamiento que se registra pero NO cuenta para la
 *    mediana. En las tandas anteriores la primera corrida salia siempre
 *    desviada en todas las variantes a la vez (alta con 1 instancia, baja con
 *    3), asi que descartarla quita ruido sin ocultar nada: la ronda 0 queda en
 *    el JSON con warmup: true.
 *  - Recoge el audit unused-javascript completo: bytes sin usar totales y por
 *    script, para poder comparar celdas sin depender del resumen.
 *
 * Uso: node .perf/m-lh-warmup.mjs <outJson> <etiqueta>=<url> [...]
 */
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2];
const VARIANTS = process.argv.slice(3).map((s) => {
  const i = s.indexOf('=');
  return { label: s.slice(0, i), url: s.slice(i + 1) };
});
const SCENARIOS = [1, 3];
const RUNS = 3;

async function measure(url) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });
  try {
    const r = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      screenEmulation: {
        mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false,
      },
      formFactor: 'mobile',
      onlyCategories: ['performance'],
    });
    const a = r.lhr.audits;
    const unused = a['unused-javascript'];
    return {
      perfScore: Math.round((r.lhr.categories.performance.score ?? 0) * 100),
      fcpMs: a['first-contentful-paint'].numericValue,
      lcpMs: a['largest-contentful-paint'].numericValue,
      tbtMs: a['total-blocking-time'].numericValue,
      cls: a['cumulative-layout-shift'].numericValue,
      siMs: a['speed-index'].numericValue,
      ttiMs: a.interactive?.numericValue ?? null,
      mainThreadMs: a['mainthread-work-breakdown']?.numericValue ?? null,
      bootupMs: a['bootup-time']?.numericValue ?? null,
      totalBytes: a['total-byte-weight']?.numericValue ?? null,
      unusedJsBytes: unused?.details?.overallSavingsBytes ?? null,
      // Por script: url, bytes totales transferidos y bytes sin usar.
      unusedJsByScript: (unused?.details?.items ?? []).map((it) => ({
        url: String(it.url ?? '').replace(/^https?:\/\/[^/]+/, ''),
        totalBytes: it.totalBytes ?? null,
        wastedBytes: it.wastedBytes ?? null,
        wastedPercent: it.wastedPercent ?? null,
      })),
    };
  } finally {
    await chrome.kill();
  }
}

const rows = [];
// Ronda 0: calentamiento. Se guarda con warmup: true y se excluye de la mediana.
for (let run = 0; run <= RUNS; run += 1) {
  for (const n of SCENARIOS) {
    for (const v of VARIANTS) {
      const m = await measure(`${v.url}/perf-${n}.html`);
      const row = {
        variant: v.label, scenario: n, run, warmup: run === 0, ...m,
      };
      rows.push(row);
      console.log(
        `${run === 0 ? 'CAL ' : `run=${run}`} n=${n} ${v.label.padEnd(20)} `
        + `score=${row.perfScore} lcp=${row.lcpMs.toFixed(0)} tbt=${row.tbtMs.toFixed(0)} `
        + `bootup=${(row.bootupMs ?? 0).toFixed(0)} unusedJs=${row.unusedJsBytes ?? '—'}`,
      );
    }
  }
}
writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log('escrito', OUT);
