/**
 * Desglose por paquete npm de los modulos que aterrizan en widget.js.
 * Uso: node .perf/cf-packages.mjs <stats.json> [--json]
 */
import { readFileSync } from 'node:fs';

const s = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const rows = new Map();
for (const part of Object.values(s.nodeParts)) {
  const meta = s.nodeMetas[part.metaUid];
  if (!meta || !Object.keys(meta.moduleParts || {}).includes('widget.js')) continue;
  const m = meta.id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  const key = m ? m[1] : (meta.id.includes('/src/') || meta.id.includes('/.perf/') ? 'app (src/ + .perf/)' : meta.id);
  const r = rows.get(key) || { raw: 0, n: 0 };
  r.raw += part.renderedLength; r.n += 1;
  rows.set(key, r);
}
const sorted = [...rows.entries()].sort((a, b) => b[1].raw - a[1].raw);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(Object.fromEntries(sorted.map(([k, v]) => [k, v.raw]))));
} else {
  const total = sorted.reduce((a, [, v]) => a + v.raw, 0);
  console.log(`total raw por modulo: ${total.toLocaleString('en-US')} B en ${sorted.length} paquetes`);
  sorted.slice(0, 25).forEach(([k, v]) => console.log(`  ${k.padEnd(34)} ${String(v.raw).padStart(9)}  (${v.n} mod)`));
}
