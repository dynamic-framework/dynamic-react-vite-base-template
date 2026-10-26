import { readdirSync } from 'node:fs';

import js from '@eslint/js';
import globals from 'globals';
import jsonc from 'eslint-plugin-jsonc';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// ─── Grafo de importaciones ──────────────────────────────────────────────

/** Desde fuera, una feature se usa solo por su index.ts. */
const FEATURE_INTERNALS = {
  group: ['@/features/*/**', '**/features/*/**'],
  message: 'Una feature se importa por su index.ts: @/features/<nombre>.',
};

/** Los mocks son datos de desarrollo: solo los lee la capa api/ de su feature. */
const MOCKS = {
  group: ['**/*.mock', '**/*.mock.ts'],
  message: 'Los *.mock.ts solo se importan desde la capa api/ de su feature.',
};

/** Una feature no conoce el arranque ni las páginas que la componen. */
const APP_AND_PAGES = {
  group: ['@/app', '@/app/**', '@/pages', '@/pages/**'],
  message: 'Una feature no importa src/app/ ni src/pages/: son ellos quienes la usan.',
};

/**
 * Dentro de una capa, las rutas relativas suben como mucho un nivel (a otra
 * capa de la misma feature). Lo que está más arriba se importa con @/: otra
 * feature por su index.ts y lo transversal desde @/shared.
 */
const OUTSIDE_FEATURE = {
  regex: '^\\.\\./\\.\\./',
  message: 'Fuera de la propia feature se importa con @/: otra feature por @/features/<nombre> y lo transversal desde @/shared.',
};

/** shared/ y config/ son la base: no conocen el dominio ni el arranque. */
const DOMAIN = {
  group: [
    '@/features', '@/features/**', '**/features/**',
    '@/app', '@/app/**', '**/app/**',
    '@/pages', '@/pages/**', '**/pages/**',
  ],
  message: 'src/shared/ y src/config/ no importan features, app ni pages: lo que necesiten va en src/shared/.',
};

/**
 * Un `..` después del primer segmento (`../api/../ui/x`, `./../x`) esquiva las
 * reglas de capa: las rutas relativas van sin vueltas.
 */
const WINDING_PATH = {
  regex: '^\\./\\.\\.|/\\.\\./',
  message: 'Escribe la ruta relativa sin `..` intermedios: ../<capa>/<archivo>, o @/ para salir de la feature.',
};

/**
 * Una capa no importa la puerta de su propia feature: crearía un ciclo
 * index.ts ↔ capa. La forma con alias se cubre en ownFeatureRules().
 */
const OWN_ENTRY = {
  regex: '^\\.\\.(/(index(\\.tsx?)?)?)?$',
  message: 'Dentro de la feature, importa la capa directamente (../hooks/useX), no su index.ts.',
};

/** Las capas de una feature, para prohibir el acceso entre ellas. */
const layerImports = (...layers) => layers.flatMap((name) => [`../${name}`, `../${name}/**`]);

const NETWORK = ['@/shared/http', '@/shared/http/**', '**/shared/http', '**/shared/http/**'];

function restrict(files, patterns) {
  return {
    files,
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns }],
    },
  };
}

/**
 * Cada archivo de src/ cae en un solo bloque: en flat config, un bloque
 * posterior con la misma regla reemplaza al anterior en lugar de sumarse.
 * tests/boundaries/architecture.test.ts comprueba que cada regla sigue
 * aplicando a la ruta de su capa.
 */
function architectureRules() {
  const layer = (name) => [`src/features/*/${name}/**/*.{ts,tsx}`];
  const featureBase = [FEATURE_INTERNALS, APP_AND_PAGES, OUTSIDE_FEATURE, WINDING_PATH, OWN_ENTRY];
  const networkOutsideApi = {
    group: NETWORK,
    message: 'La red se usa desde la capa api/ de una feature; aquí entra por sus hooks.',
  };

  return [
    // app/ arranca: usa cada feature por su index.ts.
    restrict(['src/app/**/*.{ts,tsx}'], [FEATURE_INTERNALS, MOCKS, networkOutsideApi]),

    // pages/ compone features por su index.ts y no conoce el arranque.
    restrict(['src/pages/**/*.{ts,tsx}'], [
      FEATURE_INTERNALS,
      MOCKS,
      networkOutsideApi,
      {
        group: ['@/app', '@/app/**', '**/app/**'],
        message: 'pages/ no importa src/app/: es app/ quien monta las páginas.',
      },
    ]),

    // Lo transversal no depende del dominio.
    restrict(
      ['src/shared/**/*.{ts,tsx}', 'src/config/**/*.{ts,tsx}'],
      [DOMAIN, MOCKS],
    ),

    // index.ts de cada feature: solo reexporta sus capas.
    restrict(['src/features/*/index.ts'], [
      FEATURE_INTERNALS,
      APP_AND_PAGES,
      MOCKS,
      networkOutsideApi,
      {
        regex: '^\\.\\./',
        message: 'index.ts reexporta las capas de su propia feature: lo de fuera se importa con @/.',
      },
      {
        group: ['./api', './api/**', './service', './service/**'],
        allowTypeImports: true,
        message: 'index.ts expone hooks/, model/ y ui/; de api/ y service/ solo tipos, para que la red se use por los hooks.',
      },
    ]),

    // api/: la única capa con red y la única que lee los mocks.
    restrict(layer('api'), [
      ...featureBase,
      {
        group: layerImports('hooks', 'service', 'ui'),
        message: 'api/ no importa hooks/, service/ ni ui/: el grafo va ui → hooks → service → api.',
      },
    ]),

    // model/: tipos de dominio y funciones puras.
    restrict(layer('model'), [
      ...featureBase,
      MOCKS,
      {
        group: [
          ...layerImports('api', 'hooks', 'service', 'ui'),
          ...NETWORK,
          '@/config', '@/config/**',
          '@/shared/ui', '@/shared/ui/**', '@/shared/hooks', '@/shared/hooks/**',
          '@dynamic-framework/ui-react', '@tanstack/*', 'axios',
          'react', 'react-dom', 'react-i18next',
        ],
        allowTypeImports: true,
        message: 'model/ es puro: solo tipos y funciones sin efectos. De otras capas entra únicamente import type.',
      },
    ]),

    // service/ (opcional): orquesta api/ y model/ entre hooks/ y api/.
    restrict(layer('service'), [
      ...featureBase,
      MOCKS,
      {
        group: [...layerImports('hooks', 'ui'), ...NETWORK],
        message: 'service/ llega a la red por api/ y no importa hooks/ ni ui/.',
      },
    ]),

    // hooks/: TanStack Query sobre api/ (o service/) y model/.
    restrict(layer('hooks'), [
      ...featureBase,
      MOCKS,
      {
        group: [...layerImports('ui'), ...NETWORK],
        message: 'hooks/ llega a la red por api/ (o service/) y no importa ui/.',
      },
    ]),

    // ui/: los datos llegan por hooks/ o por props.
    restrict(layer('ui'), [
      ...featureBase,
      MOCKS,
      {
        group: [...layerImports('api', 'service'), ...NETWORK],
        allowTypeImports: true,
        message: 'ui/ obtiene los datos de hooks/ (o por props); de api/ y service/ solo entran tipos con import type.',
      },
    ]),
  ];
}

/**
 * La forma con alias de OWN_ENTRY (`@/features/<propia>`) depende del nombre de
 * cada feature, así que se genera un bloque por carpeta de src/features/. Usa
 * la regla base no-restricted-imports para no reemplazar los bloques de capa.
 */
function ownFeatureRules() {
  const featuresDir = new URL('./src/features/', import.meta.url);
  return readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => ({
      files: [`src/features/${name}/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: [`@/features/${name}`, `@/features/${name}/**`],
            message: 'Dentro de la feature, importa la capa por ruta relativa (../hooks/useX), no por @/features/<propia>.',
          }],
        }],
      },
    }));
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },

  ...architectureRules(),
  ...ownFeatureRules(),

  // El texto visible sale de i18n (equivale a react/jsx-no-literals sobre los
  // nodos JSXText). import() no se usa en src/: el build es un único main.js
  // (iife) que lo incrusta igual, y no-restricted-imports no lo revisa, así que
  // saltaría el grafo.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'JSXText[value=/[^\\s]/]',
        message: 'El texto visible sale de t(\'...\'), con sus llaves en src/locales/*.json.',
      }, {
        selector: 'ImportExpression',
        message: 'En src/ las importaciones son estáticas: el build es un único main.js y import() saltaría el grafo de importaciones.',
      }],
    },
  },

  // Entrada de modyo-cli preview: carga el cliente del servidor de desarrollo
  // con import().
  {
    files: ['src/app/modyo-preview-entry.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // Las variables de configuración van en orden alfabético; `--fix` las
  // reordena.
  {
    files: ['src/config/*.json'],
    plugins: { jsonc },
    language: 'jsonc/x',
    rules: {
      'jsonc/sort-keys': ['error', 'asc', {
        caseSensitive: false,
        natural: true,
      }],
    },
  },
]);
