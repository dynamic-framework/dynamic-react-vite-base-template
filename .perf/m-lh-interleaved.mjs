/**
 * Lighthouse movil sobre varias variantes, con las variantes INTERCALADAS.
 *
 * En vez de hacer las 3 corridas de una variante y luego las 3 de la siguiente,
 * hace una ronda completa de todas las variantes y repite. Asi una deriva
 * termica o de carga de la maquina afecta por igual a todas las celdas en vez
 * de castigar a la que se midio al final.
 *
 * Uso: node .perf/m-lh-interleaved.mjs <outJson> <etiqueta=url> [...]
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

const rows = [];
for (let run = 1; run <= RUNS; run += 1) {
  for (const n of SCENARIOS) {
    for (const v of VARIANTS) {
      const chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
      });
      const r = await lighthouse(`${v.url}/perf-${n}.html`, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        formFactor: 'mobile',
        onlyCategories: ['performance'],
      });
      const a = r.lhr.audits;
      const row = {
        variant: v.label,
        scenario: n,
        run,
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
      };
      rows.push(row);
      console.log(
        `run=${run} n=${n} ${v.label.padEnd(18)} score=${row.perfScore} `
        + `lcp=${row.lcpMs.toFixed(0)} tbt=${row.tbtMs.toFixed(0)} bootup=${(row.bootupMs ?? 0).toFixed(0)}`,
      );
      await chrome.kill();
    }
  }
}
writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log('escrito', OUT);
