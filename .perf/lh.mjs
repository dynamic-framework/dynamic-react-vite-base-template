import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:4319';
const rows = [];
for (const n of [1, 3, 5]) {
  for (let run = 1; run <= 3; run++) {
    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    });
    const r = await lighthouse(`${BASE}/perf-${n}.html`, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      // formFactor movil + throttling simulado por defecto (Lighthouse mobile)
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
      ttiMs: a['interactive']?.numericValue ?? null,
      mainThreadMs: a['mainthread-work-breakdown']?.numericValue ?? null,
      bootupMs: a['bootup-time']?.numericValue ?? null,
      totalBytes: a['total-byte-weight']?.numericValue ?? null,
      unusedJsBytes: a['unused-javascript']?.details?.overallSavingsBytes ?? null,
      unusedCssBytes: a['unused-css-rules']?.details?.overallSavingsBytes ?? null,
    };
    rows.push(row);
    console.log(
      `n=${n} run=${run} score=${row.perfScore} fcp=${row.fcpMs.toFixed(0)} `
      + `lcp=${row.lcpMs.toFixed(0)} tbt=${row.tbtMs.toFixed(0)} cls=${row.cls.toFixed(4)} `
      + `si=${row.siMs.toFixed(0)} tti=${(row.ttiMs ?? 0).toFixed(0)} bootup=${(row.bootupMs ?? 0).toFixed(0)}`,
    );
    await chrome.kill();
  }
}
writeFileSync(new URL('results-lighthouse.json', import.meta.url), JSON.stringify(rows, null, 2));
console.log('escrito results-lighthouse.json');
