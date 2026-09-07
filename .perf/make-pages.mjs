/**
 * Genera las paginas del harness de runtime en dist-perf/.
 *
 * Cada instancia recibe una copia del bundle en un URL distinto
 * (widget-1.js ... widget-5.js) porque el module cache de ES modules ejecuta
 * un modulo una sola vez por URL: copias distintas => grafos de modulos
 * independientes, que es como el widget manager de Modyo entrega widgets
 * separados en una misma pagina.
 *
 * Uso: node .perf/make-pages.mjs
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist-perf';
const MAX = 5;

for (let i = 1; i <= MAX; i += 1) {
  copyFileSync(join(OUT, 'widget.js'), join(OUT, `widget-${i}.js`));
}

const page = (title, roots, scripts) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/widget.css">
</head>
<body>
${roots}
${scripts}
</body>
</html>
`;

const root = (i) => `<div data-widget-root="${i}" class="widget-name"></div>`;
const script = (i) => `<script type="module" src="/widget-${i}.js"></script>`;
const range = (n) => Array.from({ length: n }, (_, k) => k + 1);

for (const n of [1, 3, 5]) {
  writeFileSync(
    join(OUT, `perf-${n}.html`),
    page(
      `Baseline v1.2.0 - ${n} instancia(s)`,
      range(n).map(root).join('\n'),
      range(n).map(script).join('\n'),
    ),
  );
}

// Control del mecanismo: 3 script tags al MISMO URL. El module cache ejecuta
// el modulo una sola vez, asi que debe montarse 1 instancia y existir 1 React.
writeFileSync(
  join(OUT, 'perf-dedup.html'),
  page(
    'Control: mismo URL 3 veces',
    range(3).map(root).join('\n'),
    range(3).map(() => script(1)).join('\n'),
  ),
);

console.log('paginas generadas en', OUT);
