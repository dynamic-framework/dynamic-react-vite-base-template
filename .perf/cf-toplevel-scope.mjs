/**
 * Cuenta las declaraciones lexicas top-level del bundle (const/let/class).
 * En <script type="module"> cada copia tiene su propio ambito; en un <script>
 * clasico todas comparten el ambito de script, asi que la segunda copia choca.
 * Uso: node .perf/cf-toplevel-scope.mjs <bundle.js>
 */
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

const src = readFileSync(process.argv[2], 'utf8');
let ast; let parsedAs;
try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); parsedAs = 'script'; }
catch (e) { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); parsedAs = `module (como script falla: ${e.message})`; }

const lex = []; const vars = []; const fns = [];
for (const n of ast.body) {
  if (n.type === 'VariableDeclaration') {
    const names = n.declarations.map((d) => (d.id.type === 'Identifier' ? d.id.name : '(patron)'));
    (n.kind === 'var' ? vars : lex).push(...names);
  } else if (n.type === 'FunctionDeclaration') fns.push(n.id.name);
  else if (n.type === 'ClassDeclaration') lex.push(n.id.name);
}
console.log(JSON.stringify({
  file: process.argv[2], parsedAs, topLevelStatements: ast.body.length,
  lexicalDeclarations: lex.length, varDeclarations: vars.length, functionDeclarations: fns.length,
  firstLexical: lex.slice(0, 8), hasCirclePower: lex.includes('CirclePower'),
}, null, 2));
