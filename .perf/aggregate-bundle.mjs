import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync('.perf/stats.json','utf8'));

const BUCKETS = [
  ['react-dom',            id => /node_modules\/react-dom\//.test(id) || /node_modules\/scheduler\//.test(id)],
  ['react',                id => /node_modules\/react\//.test(id) || /node_modules\/react-is\//.test(id)],
  ['@dynamic-framework/ui-react', id => /node_modules\/@dynamic-framework\/ui-react\//.test(id)],
  ['lucide-react',         id => /node_modules\/lucide-react\//.test(id)],
  ['framer-motion',        id => /node_modules\/framer-motion\//.test(id) || /node_modules\/motion-dom\//.test(id) || /node_modules\/motion-utils\//.test(id)],
  ['i18next',              id => /node_modules\/i18next\//.test(id)],
  ['react-i18next',        id => /node_modules\/react-i18next\//.test(id)],
  ['@tanstack/react-query',id => /node_modules\/@tanstack\//.test(id)],
  ['zustand',              id => /node_modules\/zustand\//.test(id)],
  ['@floating-ui',         id => /node_modules\/@floating-ui\//.test(id)],
];

const rows = new Map();
const restDetail = new Map();
const add = (m,k,p) => { const r = m.get(k) || {raw:0,gz:0,br:0,n:0}; r.raw+=p.renderedLength; r.gz+=p.gzipLength; r.br+=p.brotliLength; r.n++; m.set(k,r); };

// only parts that landed in main.js (JS bundle)
for (const [uid,part] of Object.entries(s.nodeParts)) {
  const meta = s.nodeMetas[part.metaUid];
  if (!meta) continue;
  const inJs = Object.keys(meta.moduleParts||{}).includes('main.js');
  if (!inJs) continue;
  const id = meta.id;
  let bucket = BUCKETS.find(([,test]) => test(id))?.[0];
  if (!bucket) {
    bucket = 'resto';
    // attribute rest to its npm package (or app src)
    const m = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    add(restDetail, m ? m[1] : (id.includes('/src/') ? 'app (src/)' : id), part);
  }
  add(rows,bucket,part);
}

const total = [...rows.values()].reduce((a,r)=>({raw:a.raw+r.raw,gz:a.gz+r.gz,br:a.br+r.br}),{raw:0,gz:0,br:0});
const fmt = n => n.toLocaleString('en-US');
const pct = (n,t) => (100*n/t).toFixed(2)+'%';

const order = [...BUCKETS.map(b=>b[0]),'resto'];
console.log('| Dependencia | Raw (B) | % raw | Gzip (B) | % gzip | Brotli (B) | % brotli | Módulos |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const k of order) {
  const r = rows.get(k); if (!r) { console.log(`| ${k} | 0 | 0% | 0 | 0% | 0 | 0% | 0 |`); continue; }
  console.log(`| ${k} | ${fmt(r.raw)} | ${pct(r.raw,total.raw)} | ${fmt(r.gz)} | ${pct(r.gz,total.gz)} | ${fmt(r.br)} | ${pct(r.br,total.br)} | ${r.n} |`);
}
console.log(`| **TOTAL** | **${fmt(total.raw)}** | 100% | **${fmt(total.gz)}** | 100% | **${fmt(total.br)}** | 100% | ${[...rows.values()].reduce((a,r)=>a+r.n,0)} |`);

console.log('\n--- desglose de "resto" (top 20 por raw) ---');
console.log('| Paquete | Raw (B) | % del bundle raw | Gzip (B) | Brotli (B) |');
console.log('|---|---:|---:|---:|---:|');
[...restDetail.entries()].sort((a,b)=>b[1].raw-a[1].raw).slice(0,20)
  .forEach(([k,r])=>console.log(`| ${k} | ${fmt(r.raw)} | ${pct(r.raw,total.raw)} | ${fmt(r.gz)} | ${fmt(r.br)} |`));
const restTot = [...restDetail.values()].reduce((a,r)=>a+r.raw,0);
console.log(`\n(resto total raw = ${fmt(restTot)} en ${restDetail.size} paquetes/módulos)`);
