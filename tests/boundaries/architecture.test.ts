// @vitest-environment node
/**
 * El grafo de importaciones vive en eslint.config.js y se aplica por la ruta
 * del archivo. Si una carpeta cambia de nombre, el glob deja de coincidir y la
 * regla se apaga sin avisar: `npm run lint` sigue en verde. Aquí se lintea
 * código de prueba con la ruta de cada capa para comprobar que cada límite
 * sigue aplicando y que lo permitido sigue permitido, y se comprueba que todo
 * archivo real de src/ cae bajo alguna regla del grafo.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const RULE = '@typescript-eslint/no-restricted-imports';

const eslint = new ESLint({ cwd: ROOT });

async function messagesFor(filePath: string, code: string, ruleId: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${code}\n`, { filePath: path.join(ROOT, filePath) });
  return result.messages.filter((m) => m.ruleId === ruleId).map((m) => m.message);
}

const violations = (filePath: string, code: string) => messagesFor(filePath, code, RULE);

const FORBIDDEN: Array<[string, string, string]> = [
  // app/ y pages/
  ['pages entra a las carpetas de una feature', 'src/pages/X.tsx',
    "import { useX } from '@/features/sample/hooks/useX';"],
  ['app entra a las carpetas de una feature por ruta relativa', 'src/app/X.tsx',
    "import { useX } from '../features/sample/hooks/useX';"],
  ['app importa un mock', 'src/app/X.tsx',
    "import { mockX } from '@/features/sample/api/x.mock';"],

  // shared/ y config/
  ['shared importa una feature', 'src/shared/http/X.ts',
    "import { useX } from '@/features/sample';"],
  ['shared importa app', 'src/shared/ui/X.tsx',
    "import App from '@/app/App';"],
  ['config importa una página', 'src/config/X.ts',
    "import HomePage from '@/pages/HomePage';"],
  ['shared importa una feature por ruta relativa', 'src/shared/lib/X.ts',
    "import { useX } from '../../features/sample';"],
  ['shared importa un mock', 'src/shared/lib/X.ts',
    "import { mockX } from './x.mock';"],

  // index.ts de la feature
  ['index.ts sale de su feature por ruta relativa', 'src/features/sample/index.ts',
    "export { useY } from '../other/hooks/useY';"],
  ['index.ts importa un mock', 'src/features/sample/index.ts',
    "export { mockX } from './api/x.mock';"],
  ['index.ts importa app', 'src/features/sample/index.ts',
    "export { default } from '@/app/App';"],

  // Entre features y hacia fuera
  ['una feature entra a otra por ruta relativa', 'src/features/sample/hooks/X.ts',
    "import { mapY } from '../../other/model/y';"],
  ['una feature entra a las carpetas de otra por alias', 'src/features/sample/ui/X.tsx',
    "import { YView } from '@/features/other/ui/YView';"],
  ['una feature importa una página', 'src/features/sample/ui/X.tsx',
    "import HomePage from '@/pages/HomePage';"],

  // api/
  ['api importa hooks', 'src/features/sample/api/X.ts',
    "import { sampleKeys } from '../hooks/useSample';"],
  ['api importa service', 'src/features/sample/api/X.ts',
    "import { runSample } from '../service/sampleService';"],
  ['api importa ui', 'src/features/sample/api/X.ts',
    "import { SampleView } from '../ui/SampleView';"],

  // model/
  ['model importa un valor de api', 'src/features/sample/model/X.ts',
    "import { getSample } from '../api/SampleRepository';"],
  ['model usa la red', 'src/features/sample/model/X.ts',
    "import { api } from '@/shared/http/client';"],
  ['model lee la configuración', 'src/features/sample/model/X.ts',
    "import { USE_MOCKS } from '@/config/widgetConfig';"],
  ['model usa TanStack Query', 'src/features/sample/model/X.ts',
    "import { useQuery } from '@tanstack/react-query';"],
  ['model importa un mock', 'src/features/sample/model/X.ts',
    "import { mockSample } from '../api/sample.mock';"],

  // service/
  ['service importa hooks', 'src/features/sample/service/X.ts',
    "import { useSample } from '../hooks/useSample';"],
  ['service usa la red sin pasar por api', 'src/features/sample/service/X.ts',
    "import { api } from '@/shared/http/client';"],
  ['service importa un mock', 'src/features/sample/service/X.ts',
    "import { mockSample } from '../api/sample.mock';"],

  // hooks/
  ['hooks importa ui', 'src/features/sample/hooks/X.ts',
    "import { SampleView } from '../ui/SampleView';"],
  ['hooks usa la red sin pasar por api', 'src/features/sample/hooks/X.ts',
    "import { api } from '@/shared/http/client';"],
  ['hooks importa un mock', 'src/features/sample/hooks/X.ts',
    "import { mockSample } from '../api/sample.mock';"],

  // ui/
  ['ui importa un valor de api', 'src/features/sample/ui/X.tsx',
    "import { getSample } from '../api/SampleRepository';"],
  ['ui importa un valor de service', 'src/features/sample/ui/X.tsx',
    "import { runSample } from '../service/sampleService';"],
  ['ui usa la red', 'src/features/sample/ui/X.tsx',
    "import { api } from '@/shared/http/client';"],
  ['ui importa un mock', 'src/features/sample/ui/X.tsx',
    "import { mockSample } from '../api/sample.mock';"],
];

const ALLOWED: Array<[string, string, string]> = [
  ['pages usa una feature por su index', 'src/pages/X.tsx',
    "import { useSample } from '@/features/sample';"],
  ['app usa pages, shared y config', 'src/app/X.tsx',
    "import HomePage from '@/pages/HomePage';\nimport { ErrorBoundary } from '@/shared/ui';\nimport { SITE_LANG } from '@/config/widgetConfig';"],
  ['una feature usa otra por su index', 'src/features/sample/ui/X.tsx',
    "import { useOther } from '@/features/other';"],
  ['index.ts reexporta sus capas', 'src/features/sample/index.ts',
    "export { useSample } from './hooks/useSample';\nexport type { Sample } from './model/sample';"],
  ['api lee su mock, su dto, el modelo, la red y la configuración', 'src/features/sample/api/X.ts',
    "import { mockSample } from './sample.mock';\nimport type { ApiSample } from './sample.dto';\nimport type { Sample } from '../model/sample';\nimport { api } from '@/shared/http/client';\nimport { USE_MOCKS } from '@/config/widgetConfig';"],
  ['model importa un tipo de api', 'src/features/sample/model/X.ts',
    "import type { ApiSample } from '../api/sample.dto';"],
  ['service usa api y model', 'src/features/sample/service/X.ts',
    "import { getSample } from '../api/SampleRepository';\nimport { toSample } from '../model/sample';"],
  ['hooks usa api, service y model', 'src/features/sample/hooks/X.ts',
    "import { getSample } from '../api/SampleRepository';\nimport { runSample } from '../service/sampleService';\nimport type { Sample } from '../model/sample';"],
  ['ui usa hooks, model y shared', 'src/features/sample/ui/X.tsx',
    "import { useSample } from '../hooks/useSample';\nimport type { Sample } from '../model/sample';\nimport { LoadingState } from '@/shared/ui';\nimport { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';"],
  ['ui importa un tipo de api', 'src/features/sample/ui/X.tsx',
    "import type { ApiSample } from '../api/sample.dto';"],
  ['shared usa config', 'src/shared/http/X.ts',
    "import { API_BASE_URL } from '@/config/widgetConfig';"],
  ['config usa shared/lib', 'src/config/X.ts',
    "import liquidParser from '@/shared/lib/liquidParser';"],
];

/** Archivos de src/ que no importan nada y quedan fuera del grafo. */
const OUTSIDE_GRAPH = [path.join('src', 'vite.env.d.ts')];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return /\.tsx?$/.test(entry) ? [path.relative(ROOT, full)] : [];
  });
}

describe('grafo de importaciones (eslint.config.js)', () => {
  it.each(FORBIDDEN)('rechaza: %s', async (_case, filePath, code) => {
    expect(await violations(filePath, code)).not.toEqual([]);
  });

  it.each(ALLOWED)('permite: %s', async (_case, filePath, code) => {
    expect(await violations(filePath, code)).toEqual([]);
  });

  it('todo archivo de src/ cae bajo una regla del grafo', async () => {
    const files = walk(path.join(ROOT, 'src')).filter((file) => !OUTSIDE_GRAPH.includes(file));
    expect(files.length).toBeGreaterThan(10);

    const uncovered: string[] = [];
    for (const file of files) {
      const config = await eslint.calculateConfigForFile(path.join(ROOT, file));
      const setting = config?.rules?.[RULE];
      const severity = Array.isArray(setting) ? setting[0] : setting;
      if (severity !== 2 && severity !== 'error') {
        uncovered.push(file);
      }
    }
    expect(uncovered, 'Archivos sin regla del grafo: revisa los globs de architectureRules().').toEqual([]);
  });

  it('el código de src/ respeta el grafo', async () => {
    const results = await eslint.lintFiles([path.join(ROOT, 'src/**/*.{ts,tsx}')]);
    const found = results.flatMap((result) => result.messages
      .filter((m) => m.ruleId === RULE)
      .map((m) => `${path.relative(ROOT, result.filePath)}:${m.line} ${m.message}`));
    expect(found).toEqual([]);
  });
});

describe('texto visible y configuración (eslint.config.js)', () => {
  it('rechaza texto literal en JSX', async () => {
    const messages = await messagesFor(
      'src/features/sample/ui/X.tsx',
      'export const X = () => <p>Hola</p>;',
      'no-restricted-syntax',
    );
    expect(messages).not.toEqual([]);
  });

  it('permite texto que sale de t()', async () => {
    const messages = await messagesFor(
      'src/pages/X.tsx',
      "const t = (key: string) => key;\nexport const X = () => <p>{t('title')}</p>;",
      'no-restricted-syntax',
    );
    expect(messages).toEqual([]);
  });

  it('rechaza llaves desordenadas en src/config/*.json', async () => {
    const messages = await messagesFor('src/config/liquid.json', '{ "b": 1, "a": 2 }', 'jsonc/sort-keys');
    expect(messages).not.toEqual([]);
  });

  it('acepta llaves en orden alfabético en src/config/*.json', async () => {
    const messages = await messagesFor('src/config/liquid.json', '{ "a": 1, "b": 2 }', 'jsonc/sort-keys');
    expect(messages).toEqual([]);
  });
});
