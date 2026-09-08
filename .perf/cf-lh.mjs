/**
 * Lighthouse movil (throttling por defecto) sobre una variante del harness.
 * Uso: node .perf/cf-lh.mjs <baseUrl> <outJson> [escenarios=1,3] [corridas=3]
 */
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2];
const OUT = process.argv[3];
const SCENARIOS = (process.argv[4] ?? '1,3').split(',').map(Number);
const RUNS = Number(process.argv[5] ?? 3);

const rows = [];
for (const n of SCENARIOS) {
  for (let run = 1; run <= RUNS; run += 1) {
    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
    const r = await lighthouse(`${BASE}/perf-${n}.html`, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
      formFactor: 'mobile',
      onlyCategories: ['performance'],
    });
    const a = r.lhr.audits;
    const row = {
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
      unusedJsBytes: a['unused-javascript']?.details?.overallSavingsBytes ?? null,
      unusedCssBytes: a['unused-css-rules']?.details?.overallSavingsBytes ?? null,
    };
    rows.push(row);
    console.log(`n=${n} run=${run} score=${row.perfScore} fcp=${row.fcpMs.toFixed(0)} lcp=${row.lcpMs.toFixed(0)} tbt=${row.tbtMs.toFixed(0)} bootup=${(row.bootupMs ?? 0).toFixed(0)}`);
    await chrome.kill();
  }
}
writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log('escrito', OUT);
