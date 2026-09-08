/**
 * Verificacion visual de los iconos del nucleo, del registro del consumidor y
 * del fallback, sobre la pagina que monta .perf/widget-entry-core-icons.tsx.
 *
 * Comprueba por nombre que exista un <svg> con la clase que Lucide compone.
 * Ojo: la clase refleja el ARCHIVO del icono, no el nombre pedido
 * (createLucideIcon.js compone `lucide-${iconName}` con el nombre kebab del
 * archivo), asi que `AlertCircle` pinta `lucide-circle-alert`. El mapa
 * nombre -> archivo se lee del indice ESM de Lucide, igual que hace el plugin,
 * y no se deriva de una transformacion PascalCase -> kebab.
 *
 * Necesita playwright: ejecutar desde un directorio que lo tenga instalado.
 *
 * Uso: node check-core-icons.mjs <url> <ruta/al/dist/esm/lucide-react.js> [outJson]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const URL_PAGINA = process.argv[2];
const LUCIDE_INDEX = process.argv[3];
const OUT = process.argv[4];

/** nombre de export -> archivo kebab, leido del indice ESM. */
function iconFileMap(indexPath) {
  const src = readFileSync(indexPath, 'utf8');
  const map = new Map();
  const re = /export\s*\{([^}]*)\}\s*from\s*'\.\/icons\/([^']+)\.js'/g;
  for (const m of src.matchAll(re)) {
    const file = m[2];
    for (const spec of m[1].split(',')) {
      const parts = spec.trim().split(/\s+as\s+/);
      if (parts.length === 2 && parts[0].trim() === 'default') map.set(parts[1].trim(), file);
    }
  }
  return map;
}

const CORE = [
  'AlertCircle', 'AlertTriangle', 'Calendar', 'Check', 'CheckCircle',
  'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp', 'Eye', 'EyeOff',
  'Info', 'Minus', 'Plus', 'Search', 'Upload', 'X', 'Circle', 'CircleCheck',
  'CircleCheckBig', 'Download', 'FileText', 'MoreVertical', 'Paperclip',
  'RefreshCw', 'Share2', 'Trash',
];
const WIDGET = ['Book', 'Brush', 'Layout'];

const map = iconFileMap(LUCIDE_INDEX);
const esperado = Object.fromEntries(
  [...CORE, ...WIDGET].map((n) => [n, map.get(n) ?? null]),
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const consola = [];
page.on('pageerror', (e) => consola.push({ tipo: 'pageerror', texto: String(e.message) }));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    consola.push({ tipo: m.type(), texto: m.text() });
  }
});
await page.goto(URL_PAGINA, { waitUntil: 'load' });
await page.waitForTimeout(3500);

const resultado = await page.evaluate((esp) => {
  const clasesSvg = (root) => [...root.querySelectorAll('svg')]
    .flatMap((s) => String(s.getAttribute('class') ?? '').split(/\s+/))
    .filter((c) => c.startsWith('lucide-'));

  const porNombre = {};
  for (const [nombre, archivo] of Object.entries(esp)) {
    const celda = document.querySelector(`[data-icon="${nombre}"]`);
    const clases = celda ? clasesSvg(celda) : [];
    const fallback = celda
      ? [...celda.querySelectorAll('i.d-icon')].map((n) => n.className)
      : [];
    porNombre[nombre] = {
      archivoEsperado: archivo,
      claseEsperada: archivo ? `lucide-${archivo}` : null,
      svgPresente: clases.length > 0,
      clasesEncontradas: clases,
      coincide: archivo ? clases.includes(`lucide-${archivo}`) : false,
      fallback,
    };
  }

  // Que icono del nucleo pinto realmente cada componente.
  const porComponente = {};
  for (const sec of document.querySelectorAll('[data-comp]')) {
    const id = sec.getAttribute('data-comp');
    porComponente[id] = {
      svgs: sec.querySelectorAll('svg').length,
      clasesLucide: [...new Set(clasesSvg(sec))].sort(),
      fallbacks: [...sec.querySelectorAll('i.d-icon')].map((n) => n.className),
    };
  }

  const reg = document.querySelector('[data-icon-registrado]');
  const inex = document.querySelector('[data-icon-inexistente]');

  return {
    porNombre,
    porComponente,
    registrado: {
      svgInline: !!reg?.querySelector('svg[data-testid="svg-registrado"]'),
      claseLucide: reg ? clasesSvg(reg) : [],
      fallback: reg ? [...reg.querySelectorAll('i.d-icon')].map((n) => n.className) : [],
    },
    inexistente: {
      svgs: inex?.querySelectorAll('svg').length ?? -1,
      fallback: inex ? [...inex.querySelectorAll('i.d-icon')].map((n) => n.className) : [],
      textoInterrogacion: inex?.textContent?.trim() ?? null,
    },
    totalSvgPagina: document.querySelectorAll('svg').length,
    totalFallbackPagina: document.querySelectorAll('i.d-icon').length,
  };
}, esperado);

// Segunda pasada: iconos que solo aparecen con estado.
//  - DBoxFile pinta Paperclip y Trash por archivo cargado (DBoxFile.js:22).
//  - DInputPassword alterna Eye / EyeOff al pulsar el ojo, y solo muestra uno
//    a la vez.
const interaccion = { archivoCargado: false, toggleContrasena: false };
try {
  await page.setInputFiles('[data-comp="dboxfile"] input[type=file]', {
    name: 'comprobante.png',
    mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
  });
  await page.waitForTimeout(600);
  interaccion.archivoCargado = true;
} catch (e) {
  interaccion.errorArchivo = String(e).slice(0, 200);
}
try {
  await page.locator('[data-comp="dinputpassword"] button, [data-comp="dinputpassword"] [role=button]')
    .first().click({ timeout: 4000 });
  await page.waitForTimeout(400);
  interaccion.toggleContrasena = true;
} catch (e) {
  interaccion.errorToggle = String(e).slice(0, 200);
}

const trasInteraccion = await page.evaluate(() => {
  const clasesSvg = (root) => [...root.querySelectorAll('svg')]
    .flatMap((s) => String(s.getAttribute('class') ?? '').split(/\s+/))
    .filter((c) => c.startsWith('lucide-'));
  const out = {};
  for (const sec of document.querySelectorAll('[data-comp]')) {
    out[sec.getAttribute('data-comp')] = [...new Set(clasesSvg(sec))].sort();
  }
  return out;
});

const salida = {
  url: URL_PAGINA, consola, ...resultado, interaccion, trasInteraccion,
};
if (OUT) writeFileSync(OUT, JSON.stringify(salida, null, 2));

const fallan = Object.entries(resultado.porNombre).filter(([, v]) => !v.coincide);
console.log(`nombres comprobados: ${Object.keys(resultado.porNombre).length}`);
console.log(`coinciden: ${Object.keys(resultado.porNombre).length - fallan.length}`);
console.log(`fallan: ${fallan.length}${fallan.length ? ` -> ${fallan.map(([k]) => k).join(', ')}` : ''}`);
console.log(`registrado como SVG en linea: ${resultado.registrado.svgInline}`);
console.log(`inexistente -> fallback: ${JSON.stringify(resultado.inexistente.fallback)}`);
console.log(`interaccion: archivo=${interaccion.archivoCargado} toggle=${interaccion.toggleContrasena}`);
const nuevas = Object.entries(trasInteraccion)
  .flatMap(([k, v]) => v.filter((c) => !(resultado.porComponente[k]?.clasesLucide ?? []).includes(c)).map((c) => `${k}:${c}`));
console.log(`clases nuevas tras interaccion: ${nuevas.length ? nuevas.join(', ') : '(ninguna)'}`);
console.log(`errores/avisos de consola: ${consola.length}`);
for (const c of consola.slice(0, 10)) console.log(`   [${c.tipo}] ${c.texto.slice(0, 160)}`);
await browser.close();
