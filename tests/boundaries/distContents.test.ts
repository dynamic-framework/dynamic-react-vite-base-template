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
 * El widget solo publica estos tres archivos: el sitio de Modyo ya sirve el
 * CSS de Dynamic, el theme y las fuentes. Cualquier otro archivo en dist/ (una
 * imagen importada que Vite emite aparte, algo copiado de public/, un asset que
 * emite un plugin) se subiría con el widget sin que nadie lo pidiera.
 */
const PUBLISHED_FILES = ['index.html', 'main.css', 'main.js'];

describe('dist/', () => {
  let outDir: string;

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
  }, 60_000);

  afterAll(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('solo contiene main.js, main.css e index.html', () => {
    const files = fs.readdirSync(outDir, { recursive: true, encoding: 'utf8' });
    expect(files.sort()).toEqual(PUBLISHED_FILES);
  });
});
