/**
 * Tamanos raw / gzip -9 / brotli -q 11 de los artefactos de un build.
 * Uso: node .perf/cf-sizes.mjs <dir> [etiqueta]
 * Salida: JSON por stdout.
 */
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { join } from 'node:path';

const dir = process.argv[2];
const label = process.argv[3] ?? dir;
const out = { label, dir, files: {} };
for (const f of ['widget.js', 'widget.css']) {
  const p = join(dir, f);
  if (!existsSync(p)) { out.files[f] = null; continue; }
  const raw = readFileSync(p);
  out.files[f] = {
    raw: raw.length,
    gzip: gzipSync(raw, { level: 9 }).length,
    brotli: brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
}
console.log(JSON.stringify(out));
