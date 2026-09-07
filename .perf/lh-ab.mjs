/**
 * Comparacion A/B intercalada con Lighthouse movil.
 * Cada ronda mide las dos variantes seguidas, de modo que la deriva termica o
 * de carga de la maquina afecte por igual a ambas.
 *
 * Requiere dos servidores estaticos ya levantados (ver lh-ab.sh).
 * Uso: node .perf/lh-ab.mjs <rondas> <escenarios: 1,3>
 */
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { writeFileSync } from 'node:fs';

const ROUNDS = Number(process.argv[2] ?? 5);
const SCENARIOS = (process.argv[3] ?? '1,3').split(',').map(Number);
const VARIANTS = [
  { name: 'base', base: 'http://127.0.0.1:4319' },
  { name: 'b1', base: 'http://127.0.0.1:4320' },
];

const rows = [];
for (let round = 1; round <= ROUNDS; round += 1) {
  for (const n of SCENARIOS) {
    for (const v of VARIANTS) {
      const chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
      });
      const r = await lighthouse(`${v.base}/perf-${n}.html`, {
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
      const row = {
        variant: v.name,
        scenario: n,
        round,
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
        unusedJsBytes: a['unused-javascript']?.details?.overallSavingsBytes ?? null,
      };
      rows.push(row);
      console.log(
        `r${round} n=${n} ${v.name.padEnd(4)} score=${String(row.perfScore).padStart(3)} `
        + `fcp=${row.fcpMs.toFixed(0).padStart(5)} lcp=${row.lcpMs.toFixed(0).padStart(5)} `
        + `tbt=${row.tbtMs.toFixed(0).padStart(4)} si=${row.siMs.toFixed(0).padStart(5)} `
        + `tti=${(row.ttiMs ?? 0).toFixed(0).padStart(5)} bootup=${(row.bootupMs ?? 0).toFixed(0).padStart(4)} `
        + `mainThread=${(row.mainThreadMs ?? 0).toFixed(0).padStart(5)}`,
      );
      await chrome.kill();
    }
  }
}
writeFileSync(new URL('results-lh-ab.json', import.meta.url), JSON.stringify(rows, null, 2));
console.log('escrito results-lh-ab.json');
