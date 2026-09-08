import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

const src = readFileSync('node_modules/@dynamic-framework/ui-react/dist/index.esm.js','utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

const imports = new Map(); // local -> source
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') {
    for (const s of n.specifiers) imports.set(s.local.name, n.source.value);
  }
}

// statements that Rollup treats as side effects at top level:
// ExpressionStatement, and VariableDeclaration whose init is a call/new (impure).
const impure = [];
const walk = (node, fn) => {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const k in node) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, fn));
    else if (v && typeof v.type === 'string') walk(v, fn);
  }
};
const idsIn = (node) => { const s = new Set(); walk(node, n => { if (n.type === 'Identifier') s.add(n.name); }); return s; };

for (const n of ast.body) {
  if (n.type === 'ExpressionStatement') {
    impure.push({ kind: 'expr', line: n.loc.start.line, code: src.slice(n.start, Math.min(n.end, n.start+110)), ids: idsIn(n) });
  } else if (n.type === 'VariableDeclaration') {
    for (const d of n.declarations) {
      if (!d.init) continue;
      const t = d.init.type;
      if (t === 'CallExpression' || t === 'NewExpression' || t === 'TaggedTemplateExpression') {
        impure.push({ kind: 'var', name: d.id.name, line: n.loc.start.line, code: src.slice(n.start, Math.min(n.end, n.start+110)), ids: idsIn(d.init) });
      }
    }
  }
}

const TARGETS = ['google-libphonenumber','html2canvas','react-select','@splidejs/react-splide','react-datepicker','react-international-phone','react-responsive-pagination','file-selector','currency.js','@react-input/mask','date-fns','react-hot-toast','lucide-react'];
console.log(`total top-level statements: ${ast.body.length}, impure: ${impure.length}\n`);
for (const t of TARGETS) {
  const locals = [...imports.entries()].filter(([,s]) => s === t).map(([l]) => l);
  const hits = impure.filter(st => locals.some(l => st.ids.has(l)));
  console.log(`### ${t}  (locals: ${locals.join(', ')||'—'})`);
  if (!hits.length) console.log('   sin referencia directa desde statement top-level impuro');
  for (const h of hits) console.log(`   L${h.line} [${h.kind}${h.name?' '+h.name:''}] ${h.code.replace(/\n/g,' ')}`);
  console.log();
}
console.log('--- todos los ExpressionStatement top-level (primeros 40) ---');
impure.filter(i=>i.kind==='expr').slice(0,40).forEach(h=>console.log(`L${h.line}: ${h.code.replace(/\n/g,' ')}`));
console.log(`\n(total ExpressionStatement top-level: ${impure.filter(i=>i.kind==='expr').length})`);
