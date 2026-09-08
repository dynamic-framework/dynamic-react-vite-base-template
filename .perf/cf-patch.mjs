/**
 * Aplica/revierte los parches contrafactuales sobre
 * node_modules/@dynamic-framework/ui-react (edicion directa, sin tocar el repo
 * dynamic-ui). Guarda copias pristinas *.cf-orig y regenera siempre desde ellas,
 * asi cada intervencion parte del estado base y queda aislada de las demas.
 *
 * Uso: node .perf/cf-patch.mjs <none|A|B|AB> [--diff]
 *   A  iconos: namespace de lucide-react -> mapa explicito de 4 iconos
 *   B  efectos secundarios: sideEffects ["*.css"] -> false
 *   S  (diagnostico) sideEffects:false en las dependencias que no lo declaran
 *   P  (diagnostico) /*#__PURE__*\/ en las raices top-level que retienen deps
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';

const ROOT = 'node_modules/@dynamic-framework/ui-react';
const ESM = `${ROOT}/dist/index.esm.js`;
const PKG = `${ROOT}/package.json`;
const orig = (p) => `${p}.cf-orig`;

for (const p of [ESM, PKG]) if (!existsSync(orig(p))) copyFileSync(p, orig(p));

const mode = (process.argv[2] ?? 'none').toUpperCase();
const wantDiff = process.argv.includes('--diff');

let esm = readFileSync(orig(ESM), 'utf8');
let pkg = readFileSync(orig(PKG), 'utf8');

if (mode.includes('A')) {
  const before = esm;
  esm = esm.replace(
    "import * as LucideIcons from 'lucide-react';",
    "import { Book, Brush, Layout, Plus } from 'lucide-react';\n"
    + '// [contrafactual A] mapa explicito: solo los iconos que usa el widget.\n'
    + 'const LUCIDE_ICONS = { Book, Brush, Layout, Plus };',
  );
  esm = esm.replace(
    '        const icons = LucideIcons;',
    '        const icons = LUCIDE_ICONS;',
  );
  if (esm === before || esm.includes('LucideIcons')) {
    throw new Error('parche A: no se aplico limpio (quedan referencias a LucideIcons)');
  }
}
if (mode.includes('P')) {
  const subs = [
    ["const phoneUtil = PhoneNumberUtil.getInstance();", "const phoneUtil = /*#__PURE__*/ PhoneNumberUtil.getInstance();"],
    ["var DSelect$1 = Object.assign(DSelect, {", "var DSelect$1 = /*#__PURE__*/ Object.assign(DSelect, {"],
    ["const ForwardedDCarousel = forwardRef(DCarousel);", "const ForwardedDCarousel = /*#__PURE__*/ forwardRef(DCarousel);"],
  ];
  for (const [from, to] of subs) {
    if (!esm.includes(from)) throw new Error(`parche P: no se encontro ${from}`);
    esm = esm.replace(from, to);
  }
}
if (mode.includes('B')) {
  const before = pkg;
  pkg = pkg.replace('"sideEffects": [\n    "*.css"\n  ],', '"sideEffects": false,');
  if (pkg === before) throw new Error('parche B: no se aplico');
}

// Diagnostico S: marcar como puras las dependencias que no declaran sideEffects.
const DEPS_SIN_FLAG = ['html2canvas', '@splidejs/react-splide', '@splidejs/splide', 'file-selector', 'react-responsive-pagination', 'react-international-phone', 'currency.js', '@react-input/mask', '@react-input/core'];
for (const dep of DEPS_SIN_FLAG) {
  const p = `node_modules/${dep}/package.json`;
  if (!existsSync(p)) continue;
  if (!existsSync(orig(p))) copyFileSync(p, orig(p));
  if (!mode.includes('S')) { copyFileSync(orig(p), p); continue; }
  const j = JSON.parse(readFileSync(orig(p), 'utf8'));
  j.sideEffects = false;
  writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`);
}

writeFileSync(ESM, esm);
writeFileSync(PKG, pkg);
console.log(`parche aplicado: ${mode}`);
if (wantDiff) console.log('(usa: diff -u ' + orig(ESM) + ' ' + ESM + ')');
