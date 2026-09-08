/**
 * Grafo de retencion en dist/index.esm.js de @dynamic-framework/ui-react.
 *
 * Modela lo que hace Rollup cuando el modulo se considera CON efectos
 * secundarios (moduleSideEffects: true): retiene todo statement top-level
 * impuro y, transitivamente, todo lo que ese statement referencia.
 *
 * Uso: node .perf/cf-retention.mjs [nombre-de-paquete ...]
 */
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

const FILE = 'node_modules/@dynamic-framework/ui-react/dist/index.esm.js';
const src = readFileSync(FILE, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

const walk = (node, fn) => {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, fn));
    else if (v && typeof v.type === 'string') walk(v, fn);
  }
};
// Solo identificadores que son referencias reales: excluye claves de objeto no
// computadas, propiedades de member expressions y nombres de parametros.
const idsIn = (node) => {
  const s = new Set();
  const skip = new Set();
  walk(node, (n) => {
    if (n.type === 'MemberExpression' && !n.computed && n.property?.type === 'Identifier') skip.add(n.property);
    if (n.type === 'Property' && !n.computed && n.key?.type === 'Identifier') skip.add(n.key);
    if (n.type === 'JSXAttribute' && n.name?.type === 'Identifier') skip.add(n.name);
  });
  walk(node, (n) => { if (n.type === 'Identifier' && !skip.has(n)) s.add(n.name); });
  return s;
};

const importOf = new Map();     // local -> paquete
const declOf = new Map();       // nombre -> { line, refs:Set, code }
const impureRoots = [];         // statements que Rollup no puede eliminar

for (const n of ast.body) {
  const code = src.slice(n.start, Math.min(n.end, n.start + 120)).replace(/\n\s*/g, ' ');
  if (n.type === 'ImportDeclaration') {
    for (const s of n.specifiers) importOf.set(s.local.name, n.source.value);
  } else if (n.type === 'FunctionDeclaration') {
    declOf.set(n.id.name, { line: n.loc.start.line, refs: idsIn(n.body), code });
  } else if (n.type === 'ClassDeclaration') {
    declOf.set(n.id.name, { line: n.loc.start.line, refs: idsIn(n), code });
  } else if (n.type === 'VariableDeclaration') {
    for (const d of n.declarations) {
      if (d.id.type !== 'Identifier') continue;
      const refs = d.init ? idsIn(d.init) : new Set();
      declOf.set(d.id.name, { line: n.loc.start.line, refs, code });
      const t = d.init?.type;
      if (t === 'CallExpression' || t === 'NewExpression' || t === 'TaggedTemplateExpression') {
        impureRoots.push({ line: n.loc.start.line, code, refs: new Set([d.id.name, ...refs]) });
      }
    }
  } else if (n.type === 'ExpressionStatement') {
    impureRoots.push({ line: n.loc.start.line, code, refs: idsIn(n) });
  }
}

// Alcanzabilidad: desde cada raiz, seguir referencias entre declaraciones top-level.
function reach(startRefs) {
  const seen = new Set();
  const stack = [...startRefs];
  const pkgs = new Map(); // paquete -> local que lo trajo
  const path = new Map(); // nombre -> desde quien
  while (stack.length) {
    const name = stack.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    if (importOf.has(name)) { pkgs.set(importOf.get(name), name); continue; }
    const d = declOf.get(name);
    if (!d) continue;
    for (const r of d.refs) if (!seen.has(r)) { path.set(r, name); stack.push(r); }
  }
  return { pkgs, seen, path };
}

// Modo --from=<nombre>: alcanzabilidad desde un binding exportado concreto.
const fromArg = process.argv.find((a) => a.startsWith('--from='));
if (fromArg) {
  const start = fromArg.split('=')[1].split(',');
  const { pkgs, seen, path: prev } = reach(start);
  console.log(`alcanzable desde ${start.join(', ')}: ${seen.size} bindings, ${pkgs.size} paquetes\n`);
  for (const [pkg, local] of [...pkgs].sort()) {
    const chain = [local];
    let cur = local;
    while (prev.has(cur)) { cur = prev.get(cur); chain.push(cur); }
    console.log(`  ${pkg.padEnd(30)} <= ${chain.reverse().map((c) => (declOf.has(c) ? `${c}(L${declOf.get(c).line})` : c)).join(' -> ')}`);
  }
  process.exit(0);
}

const targets = process.argv.slice(2).length ? process.argv.slice(2)
  : ['google-libphonenumber', 'html2canvas', 'react-select', '@splidejs/react-splide', 'lucide-react'];

console.log(`${FILE}`);
console.log(`statements top-level: ${ast.body.length} | imports: ${new Set(importOf.values()).size} paquetes | raices impuras: ${impureRoots.length}\n`);

for (const t of targets) {
  console.log(`## ${t}`);
  const locals = [...importOf.entries()].filter(([, p]) => p === t).map(([l]) => l);
  let found = false;
  for (const root of impureRoots) {
    const { pkgs, seen, path } = reach(root.refs);
    if (!pkgs.has(t)) continue;
    // reconstruir cadena root -> ... -> local del paquete
    const local = pkgs.get(t);
    const chain = [local];
    let cur = local;
    while (path.has(cur)) { cur = path.get(cur); chain.push(cur); }
    console.log(`  raiz L${root.line}: ${root.code}`);
    console.log(`  cadena: ${chain.reverse().map((c) => (declOf.has(c) ? `${c}(L${declOf.get(c).line})` : c)).join(' -> ')} => import '${t}'`);
    found = true;
    break;
  }
  if (!found) console.log(`  no alcanzable desde ninguna raiz impura (locals: ${locals.join(', ')})`);
  console.log();
}

// resumen: todos los paquetes alcanzables desde raices impuras
const all = new Map();
for (const root of impureRoots) {
  const { pkgs } = reach(root.refs);
  for (const [p] of pkgs) if (!all.has(p)) all.set(p, root);
}
console.log('--- paquetes retenidos por al menos una raiz impura ---');
[...all.entries()].sort().forEach(([p, r]) => console.log(`  ${p.padEnd(32)} <- L${r.line} ${r.code.slice(0, 60)}`));
const never = [...new Set(importOf.values())].filter((p) => !all.has(p));
console.log('\n--- paquetes NO alcanzables desde raices impuras ---');
never.forEach((p) => console.log(`  ${p}`));
