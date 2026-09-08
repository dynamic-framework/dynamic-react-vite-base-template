import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // dist* cubre dist/ y los directorios de salida del rig de medicion
  // (dist-perf, dist-viz, dist-cf-*, dist-m-*). .perf/ es instrumentacion de
  // medicion: sus entries montan React fuera de un componente y no cumplen las
  // reglas de react-refresh, que ahi no aportan nada. Ver .perf/README.md.
  globalIgnores(['dist*', '.perf/**', 'src/_examples/**']),
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
]);
