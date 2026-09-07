import { readFileSync } from 'node:fs';
const med = (a) => { const s=[...a].sort((x,y)=>x-y); const n=s.length; return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2; };
const f=(n,d=0)=>n==null?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});

const lh=JSON.parse(readFileSync('results-lighthouse.json','utf8'));
const th=JSON.parse(readFileSync('results-throttled.json','utf8'));
const un=JSON.parse(readFileSync('results-unthrottled.json','utf8'));
const by=(rows,n)=>rows.filter(r=>r.scenario===n);

console.log('### Lighthouse (movil, throttling por defecto) — mediana de 3 corridas\n');
console.log('| Escenario | Score perf | FCP (ms) | LCP (ms) | TBT (ms) | CLS | Speed Index (ms) | TTI (ms) | Bootup JS (ms) | Main thread (ms) |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const n of [1,3,5]){const r=by(lh,n);
console.log(`| ${n} instancia${n>1?'s':''} | ${f(med(r.map(x=>x.perfScore)))} | ${f(med(r.map(x=>x.fcpMs)))} | ${f(med(r.map(x=>x.lcpMs)))} | ${f(med(r.map(x=>x.tbtMs)))} | ${f(med(r.map(x=>x.cls)),4)} | ${f(med(r.map(x=>x.siMs)))} | ${f(med(r.map(x=>x.ttiMs)))} | ${f(med(r.map(x=>x.bootupMs)))} | ${f(med(r.map(x=>x.mainThreadMs)))} |`);}

console.log('\n### Lighthouse — peso y codigo sin usar (mediana)\n');
console.log('| Escenario | Total bytes transferidos | JS sin usar (B) | CSS sin usar (B) |');
console.log('|---|---:|---:|---:|');
for(const n of [1,3,5]){const r=by(lh,n);
console.log(`| ${n} | ${f(med(r.map(x=>x.totalBytes)))} | ${f(med(r.map(x=>x.unusedJsBytes)))} | ${f(med(r.map(x=>x.unusedCssBytes)))} |`);}

for(const [label,rows] of [['4x CPU + Slow 4G (equivalente a defaults moviles de Lighthouse)',th],['sin throttling',un]]){
console.log(`\n### Playwright + CDP — ${label} — mediana de 3 corridas\n`);
console.log('| Escenario | LCP (ms) | FCP (ms) | INP real (ms) | TBT (ms) | CLS | ScriptDuration (ms) | TaskDuration (ms) | Layout (ms) | RecalcStyle (ms) | Heap usado (MB) | Long tasks |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const n of [1,3,5]){const r=by(rows,n);
console.log(`| ${n} | ${f(med(r.map(x=>x.lcp)))} | ${f(med(r.map(x=>x.fcp)))} | ${f(med(r.map(x=>x.inp)))} | ${f(med(r.map(x=>x.tbt)))} | ${f(med(r.map(x=>x.cls)),4)} | ${f(med(r.map(x=>x.scriptDurationMs)))} | ${f(med(r.map(x=>x.taskDurationMs)))} | ${f(med(r.map(x=>x.layoutDurationMs)))} | ${f(med(r.map(x=>x.recalcStyleDurationMs)))} | ${f(med(r.map(x=>x.jsHeapUsedBytes/1048576)),1)} | ${f(med(r.map(x=>x.longTaskCount)))} |`);}
}

for(const [label,rows] of [['4x CPU + Slow 4G',th],['sin throttling',un]]){
console.log(`\n### Tiempo hasta el primer render por instancia — ${label} — mediana de 3 corridas\n`);
console.log('| Escenario | Instancia | Primer render (ms desde navigation start) | Duracion del commit (ms) |');
console.log('|---|---:|---:|---:|');
for(const n of [1,3,5]){const r=by(rows,n);
 for(let i=0;i<n;i++){
  const ends=r.map(x=>x.firstRenders[i]?.end).filter(v=>v!=null);
  const durs=r.map(x=>x.firstRenders[i]?.dur).filter(v=>v!=null);
  console.log(`| ${n} | ${i+1}ª en completar | ${f(med(ends))} | ${f(med(durs),1)} |`);}}
}

console.log('\n### Escalado por instancia (mediana, 4x CPU + Slow 4G)\n');
console.log('| Escenario | LCP (ms) | Δ LCP vs n=1 | ScriptDuration (ms) | ms/instancia | Heap (MB) | MB/instancia | Copias de React |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
const base=med(by(th,1).map(x=>x.lcp));
for(const n of [1,3,5]){const r=by(th,n);
 const lcp=med(r.map(x=>x.lcp)), sd=med(r.map(x=>x.scriptDurationMs)), hp=med(r.map(x=>x.jsHeapUsedBytes/1048576));
 console.log(`| ${n} | ${f(lcp)} | ${n===1?'—':'+'+f(lcp-base)} | ${f(sd)} | ${f(sd/n)} | ${f(hp,1)} | ${f(hp/n,1)} | ${med(r.map(x=>x.distinctReactInternals))} |`);}

console.log('\n### Hipotesis (b): copias de React\n');
console.log('| Escenario | Instancias montadas | Objetos internals distintos | Modulos React distintos | Modulos ReactDOM distintos | Versiones |');
console.log('|---|---:|---:|---:|---:|---|');
for(const n of [1,3,5]){const r=by(th,n)[0];
console.log(`| ${n} | ${r.instances} | ${r.distinctReactInternals} | ${r.distinctReactModules} | ${r.distinctReactDomModules} | ${r.reactVersions.join(', ')} |`);}

console.log('\n### Corridas individuales (LCP ms) para ver dispersion\n');
console.log('| Fuente | n=1 | n=3 | n=5 |');
console.log('|---|---|---|---|');
for(const [l,rows,k] of [['Lighthouse',lh,'lcpMs'],['PW 4x+4G',th,'lcp'],['PW sin throttle',un,'lcp']]){
console.log(`| ${l} | ${by(rows,1).map(x=>f(x[k])).join(' / ')} | ${by(rows,3).map(x=>f(x[k])).join(' / ')} | ${by(rows,5).map(x=>f(x[k])).join(' / ')} |`);}
