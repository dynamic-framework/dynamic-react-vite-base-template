// Servidor estatico para el harness del baseline.
// Sirve dist-perf comprimido (br/gzip segun Accept-Encoding), como haria un CDN.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] ?? 4319);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const cache = new Map();
function load(p) {
  if (cache.has(p)) return cache.get(p);
  const raw = readFileSync(p);
  const e = {
    raw,
    gzip: gzipSync(raw, { level: 9 }),
    br: brotliCompressSync(raw, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }),
  };
  cache.set(p, e);
  return e;
}

createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, normalize(urlPath === '/' ? '/perf-1.html' : urlPath));
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  const e = load(file);
  const accept = req.headers['accept-encoding'] ?? '';
  let body = e.raw;
  const headers = {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  };
  if (/\bbr\b/.test(accept)) {
    body = e.br;
    headers['Content-Encoding'] = 'br';
  } else if (/\bgzip\b/.test(accept)) {
    body = e.gzip;
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers).end(body);
}).listen(PORT, () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));
