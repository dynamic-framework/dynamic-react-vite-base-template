/**
 * Tabla comparativa base vs intervencion.
 * Uso: node .perf/cf-table.mjs <label> [<label> ...]
 */
import { readFileSync, existsSync } from 'node:fs';
const med = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const f = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const load = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

for (const label of process.argv.slice(2)) {
  const sizes = load(`.perf/out/${label}-sizes.json`);
  const lh = load(`.perf/out/${label}-lh.json`);
  const c1 = load(`.perf/out/${label}-check-n1.json`);
  const c3 = load(`.perf/out/${label}-check-n3.json`);
  const row = { label };
  if (sizes) {
    row.jsRaw = sizes.files['widget.js']?.raw; row.jsGz = sizes.files['widget.js']?.gzip; row.jsBr = sizes.files['widget.js']?.brotli;
    row.cssRaw = sizes.files['widget.css']?.raw; row.cssGz = sizes.files['widget.css']?.gzip; row.cssBr = sizes.files['widget.css']?.brotli;
  }
  if (lh) {
    for (const n of [1, 3]) {
      const r = lh.filter((x) => x.scenario === n);
      if (!r.length) continue;
      row[`lcp${n}`] = med(r.map((x) => x.lcpMs)); row[`tbt${n}`] = med(r.map((x) => x.tbtMs));
      row[`fcp${n}`] = med(r.map((x) => x.fcpMs)); row[`score${n}`] = med(r.map((x) => x.perfScore));
      row[`bootup${n}`] = med(r.map((x) => x.bootupMs)); row[`bytes${n}`] = med(r.map((x) => x.totalBytes));
      row[`unusedJs${n}`] = med(r.map((x) => x.unusedJsBytes)); row[`unusedCss${n}`] = med(r.map((x) => x.unusedCssBytes));
      row[`lcpRuns${n}`] = r.map((x) => Math.round(x.lcpMs)).join('/');
      row[`tbtRuns${n}`] = r.map((x) => Math.round(x.tbtMs)).join('/');
    }
  }
  row.ok1 = c1 ? c1.ok : null; row.ok3 = c3 ? c3.ok : null;
  row.err1 = c1 ? (c1.pageErrors.length + (c1.error ? 1 : 0)) : null;
  row.err3 = c3 ? (c3.pageErrors.length + (c3.error ? 1 : 0)) : null;
  console.log(JSON.stringify(row));
}
