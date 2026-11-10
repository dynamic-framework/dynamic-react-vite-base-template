// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { build } from 'vite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

/**
 * El widget publica estos tres archivos más sus chunks (`*.chunk.js`): el sitio
 * de Modyo ya sirve el CSS de Dynamic, el theme y las fuentes. Cualquier otro
 * archivo en dist/ (una imagen importada que Vite emite aparte, algo copiado de
 * public/, un asset que emite un plugin) se subiría con el widget sin que nadie
 * lo pidiera.
 */
const ENTRY_FILES = ['index.html', 'main.css', 'main.js'];

/** Nombre que da `chunkFileNames` en vite.config.ts: `[name].[hash].chunk.js`. */
const CHUNK_FILE = /^[\w-]+\.[\w-]+\.chunk\.js$/;

/**
 * URL a la que transformDynamicImports apunta un chunk que importa main.js. En
 * el preview de Modyo cambia en cada request, así que cada chunk cargaría su
 * propia copia de main.js (y de React). Ver docs/code-splitting.md.
 */
const ENTRY_URL = 'widget_manager/';

describe('dist/', () => {
  let outDir: string;
  let files: string[];

  // Construye con el vite.config.ts real hacia un directorio temporal: no toca
  // el dist/ del proyecto. Tarda un par de segundos.
  beforeAll(async () => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-contents-'));
    await build({
      root: ROOT,
      configFile: path.join(ROOT, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    });
    files = fs.readdirSync(outDir, { recursive: true, encoding: 'utf8' }).sort();
  }, 60_000);

  afterAll(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  const chunks = () => files.filter((file) => CHUNK_FILE.test(file));

  it('contiene main.js, main.css e index.html', () => {
    expect(files).toEqual(expect.arrayContaining(ENTRY_FILES));
  });

  it('fuera de esos tres, solo contiene chunks *.chunk.js', () => {
    const others = files.filter((file) => !ENTRY_FILES.includes(file) && !CHUNK_FILE.test(file));
    expect(others).toEqual([]);
  });

  it('emite chunks (el build no colapsó a un único main.js)', () => {
    expect(chunks()).not.toEqual([]);
  });

  it('ningún chunk importa main.js', () => {
    const importingEntry = chunks().filter((file) => (
      fs.readFileSync(path.join(outDir, file), 'utf8').includes(ENTRY_URL)
    ));
    expect(
      importingEntry,
      'estos chunks importan main.js; mueve lo que comparten con el entry a un '
      + 'chunk propio en manualChunks (vite.config.ts)',
    ).toEqual([]);
  });
});
