/**
 * Composicion del bundle por paquete npm y cadenas de retencion.
 *
 * Uso: node .perf/m-composition.mjs <stats.json> [chunk=main.js] [topN=15]
 *
 * AVISO sobre los tamanos comprimidos: rollup-plugin-visualizer comprime cada
 * modulo por separado, asi que la suma de gzip/brotli por paquete queda muy por
 * encima del tamano real del archivo (la compresion pierde todo el contexto
 * entre modulos). Los porcentajes sirven para comparar participacion relativa;
 * los absolutos comprimidos NO deben sumarse ni compararse contra el archivo.
 * La columna raw es la fiable en terminos absolutos.
 *
 * Cadenas de retencion: para cada paquete que el codigo del widget no importa
 * directamente, se busca el camino mas corto por `importedBy` desde uno de sus
 * modulos hasta un modulo de src/, que es quien lo arrastra.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STATS = process.argv[2] ?? '.perf/stats.json';
const CHUNK = process.argv[3] ?? 'main.js';
const TOP = Number(process.argv[4] ?? 15);

const s = JSON.parse(readFileSync(STATS, 'utf8'));

const pkgOf = (id) => {
  const m = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  if (m) return m[1];
  if (id.includes('/src/')) return 'app (src/)';
  if (id.includes('/.perf/')) return 'app (.perf/)';
  return id.replace(/^\0/, '');
};

// --- 1. Agregacion por paquete ---
const rows = new Map();
const uidsByPkg = new Map();
for (const [, part] of Object.entries(s.nodeParts)) {
  const meta = s.nodeMetas[part.metaUid];
  if (!meta || !Object.keys(meta.moduleParts ?? {}).includes(CHUNK)) continue;
  const key = pkgOf(meta.id);
  const r = rows.get(key) ?? { raw: 0, gzip: 0, brotli: 0, n: 0 };
  r.raw += part.renderedLength;
  r.gzip += part.gzipLength ?? 0;
  r.brotli += part.brotliLength ?? 0;
  r.n += 1;
  rows.set(key, r);
  if (!uidsByPkg.has(key)) uidsByPkg.set(key, []);
  uidsByPkg.get(key).push(part.metaUid);
}

const sorted = [...rows.entries()].sort((a, b) => b[1].brotli - a[1].brotli);
const total = sorted.reduce((a, [, v]) => ({
  raw: a.raw + v.raw, gzip: a.gzip + v.gzip, brotli: a.brotli + v.brotli, n: a.n + v.n,
}), { raw: 0, gzip: 0, brotli: 0, n: 0 });

const f = (n) => n.toLocaleString('en-US');
const pct = (n, t) => `${(100 * n / t).toFixed(2)}%`;

console.log(`chunk: ${CHUNK} — ${total.n} modulos en ${sorted.length} paquetes`);
console.log(`suma por modulo: raw ${f(total.raw)} | gzip ${f(total.gzip)} | brotli ${f(total.brotli)}`);
console.log();
console.log('| # | Paquete | Raw (B) | % raw | Gzip (B) | Brotli (B) | % brotli | Módulos |');
console.log('|---:|---|---:|---:|---:|---:|---:|---:|');
sorted.slice(0, TOP).forEach(([k, v], i) => {
  console.log(`| ${i + 1} | \`${k}\` | ${f(v.raw)} | ${pct(v.raw, total.raw)} | ${f(v.gzip)} | ${f(v.brotli)} | ${pct(v.brotli, total.brotli)} | ${v.n} |`);
});
const rest = sorted.slice(TOP).reduce((a, [, v]) => ({
  raw: a.raw + v.raw, gzip: a.gzip + v.gzip, brotli: a.brotli + v.brotli, n: a.n + v.n,
}), { raw: 0, gzip: 0, brotli: 0, n: 0 });
console.log(`| — | **resto (${sorted.length - TOP} paquetes)** | ${f(rest.raw)} | ${pct(rest.raw, total.raw)} | ${f(rest.gzip)} | ${f(rest.brotli)} | ${pct(rest.brotli, total.brotli)} | ${rest.n} |`);
console.log(`| — | **TOTAL** | **${f(total.raw)}** | 100% | **${f(total.gzip)}** | **${f(total.brotli)}** | 100% | ${total.n} |`);

// --- 2. Que importa src/ directamente ---
function srcFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e)) out.push(full);
    }
  };
  walk(dir);
  return out;
}
const directos = new Set();
for (const file of srcFiles('src')) {
  const code = readFileSync(file, 'utf8');
  for (const m of code.matchAll(/from\s+'([^'.][^']*)'/g)) {
    const spec = m[1];
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    directos.add(pkg);
  }
}

// --- 3. Cadenas de retencion ---
const metaById = new Map(Object.entries(s.nodeMetas));
const shortId = (id) => id
  .replace(/^.*node_modules\//, '')
  .replace(/^.*\/(src\/.*)$/, '$1')
  .replace(/^.*\/(\.perf\/.*)$/, '$1');

/** Camino mas corto por importedBy desde un modulo del paquete hasta src/. */
function cadena(pkg) {
  const inicio = uidsByPkg.get(pkg) ?? [];
  const visto = new Set(inicio);
  let frente = inicio.map((uid) => [uid]);
  for (let depth = 0; depth < 40 && frente.length; depth += 1) {
    const siguiente = [];
    for (const camino of frente) {
      const meta = metaById.get(camino[camino.length - 1]);
      for (const { uid } of meta?.importedBy ?? []) {
        if (visto.has(uid)) continue;
        visto.add(uid);
        const m = metaById.get(uid);
        const nuevo = [...camino, uid];
        if (m && (m.id.includes('/src/') || m.id.includes('/.perf/'))) {
          return nuevo.map((u) => shortId(metaById.get(u).id));
        }
        siguiente.push(nuevo);
      }
    }
    frente = siguiente;
  }
  return null;
}

console.log();
console.log('### Cadenas de retención (paquetes > 5 KB brotli que src/ no importa directamente)');
console.log();
console.log('| Paquete | Brotli (B) | Importado directamente por src/ | Cadena de retención |');
console.log('|---|---:|:---:|---|');
for (const [k, v] of sorted) {
  if (v.brotli <= 5120) continue;
  if (k.startsWith('app (')) continue;
  const directo = directos.has(k);
  if (directo) {
    console.log(`| \`${k}\` | ${f(v.brotli)} | sí | — (import directo del widget) |`);
    continue;
  }
  const c = cadena(k);
  console.log(`| \`${k}\` | ${f(v.brotli)} | no | ${c ? c.map((x) => `\`${x}\``).join(' ← ') : '(no se encontró camino)'} |`);
}
