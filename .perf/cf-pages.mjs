/**
 * Genera las paginas del harness contrafactual.
 *
 * Uso: node .perf/cf-pages.mjs <outDir> [--script=module|classic] [--css=bundle|cdn|none] [--n=1,3]
 *
 * Mantiene la misma estructura que .perf/make-pages.mjs del baseline (una copia
 * del bundle por instancia, en URLs distintos, porque el module cache ejecuta un
 * modulo una sola vez por URL). Las unicas variantes son el tipo de <script> y
 * de donde sale el CSS de Dynamic.
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
if (!OUT) throw new Error('falta outDir');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const SCRIPT = arg('script', 'module');
const CSS = arg('css', 'bundle');
const NS = arg('n', '1,3').split(',').map(Number);

const CDN_CSS = 'https://cdn.dynamicframework.dev/assets/2.8.0/ui-react/css/dynamic-ui.css';
const MAX = Math.max(...NS);
for (let i = 1; i <= MAX; i += 1) copyFileSync(join(OUT, 'widget.js'), join(OUT, `widget-${i}.js`));

const cssLinks = () => {
  if (CSS === 'none') return '';
  if (CSS === 'cdn') {
    // El CSS de Dynamic entra una sola vez desde el CDN; widget.css queda solo
    // con los estilos propios del widget (base.scss).
    return `<link rel="stylesheet" href="${CDN_CSS}">\n<link rel="stylesheet" href="/widget.css">`;
  }
  return '<link rel="stylesheet" href="/widget.css">';
};

const page = (title, roots, scripts) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
${cssLinks()}
</head>
<body>
${roots}
${scripts}
</body>
</html>
`;

const root = (i) => `<div data-widget-root="${i}" class="widget-name"></div>`;
const script = (i) => (SCRIPT === 'classic'
  ? `<script type="text/javascript" src="/widget-${i}.js"></script>`
  : `<script type="module" src="/widget-${i}.js"></script>`);
const range = (n) => Array.from({ length: n }, (_, k) => k + 1);

for (const n of NS) {
  writeFileSync(
    join(OUT, `perf-${n}.html`),
    page(`${OUT} - ${SCRIPT} - css:${CSS} - ${n} instancia(s)`, range(n).map(root).join('\n'), range(n).map(script).join('\n')),
  );
}
console.log(`paginas en ${OUT}: n=${NS.join(',')} script=${SCRIPT} css=${CSS}`);
