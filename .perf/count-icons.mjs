/**
 * Cuenta los iconos de Lucide presentes en un bundle.
 *
 * Se apoya en la factory de Lucide, que recibe el nombre kebab-case del icono
 * como primer argumento y el nodo SVG como segundo. Hay dos formas segun como
 * quede el bundle:
 *   - factory con su nombre y nodo hoisted: createLucideIcon("book",__iconNode$q)
 *   - factory minificada y nodo en linea:   Mt("book",[["path",{...}]])
 * Exigir que el segundo argumento sea `[[` o `__iconNode` descarta falsos
 * positivos como addEventListener("click", handler).
 */
import { readFileSync } from 'node:fs';

export function countIcons(file) {
  const src = readFileSync(file, 'utf8');
  const re = /([A-Za-z$_][A-Za-z0-9$_]*)\("([a-z][a-z0-9]*(?:-[a-z0-9]+)*)",(?:\[\[|__iconNode)/g;
  const byFn = new Map();
  for (const m of src.matchAll(re)) {
    if (!byFn.has(m[1])) byFn.set(m[1], new Set());
    byFn.get(m[1]).add(m[2]);
  }
  const best = [...byFn.entries()].sort((a, b) => b[1].size - a[1].size)[0];
  return best ? { factory: best[0], count: best[1].size, names: [...best[1]].sort() } : { factory: null, count: 0, names: [] };
}

if (process.argv[2]) {
  const r = countIcons(process.argv[2]);
  console.log(JSON.stringify(r));
}
