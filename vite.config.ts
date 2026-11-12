import react from '@vitejs/plugin-react';
import path from 'path';
import transformDynamicImports from '@dynamic-framework/vite-plugin-transform-dynamic-imports';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';
import escapeLiquidInStrings from './.vite/plugins/escapeLiquidInStrings';
import lucideSubset from './.vite/plugins/lucideSubset';

export default defineConfig({
  plugins: [
    svgr(),
    react(),
    // Reescribe los import() de main.js para que los chunks se resuelvan desde
    // la carpeta del widget en Modyo (window['resourceBasePath-{{widget.wid}}']).
    // Ver docs/code-splitting.md.
    transformDynamicImports(),
    escapeLiquidInStrings(),
    // Reduces lucide-react to the subset of icons this widget uses.
    // Build-only; under dev and the CLI preview the full Lucide is visible.
    // include: icon names the widget computes at runtime and that do not
    //   appear as a string literal in src/. See the README.
    // strict: fails the build on icon={expression} when include contributes
    //   no valid icon name.
    lucideSubset({
      include: [],
      strict: false,
    }),
  ],
  server: {
    cors: true,
    origin: 'http://localhost:5173',
    allowedHosts: [
      'localhost', 
      '127.0.0.1', 
      '*.modyo.cloud',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@dynamic-framework/ui-react':
        path.resolve(__dirname, 'node_modules/@dynamic-framework/ui-react'),
      'node_modules/bootstrap':
        path.resolve(__dirname, 'node_modules/bootstrap'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    minify: 'esbuild',
    // Un unico main.css aunque haya chunks lazy: es el archivo que Modyo
    // publica como CSS del widget (MODYO_ZIP_ENTRY_CSS). Sin esto, Vite emite
    // un CSS por chunk y lo enlaza en runtime desde rutas que Modyo no sirve.
    cssCodeSplit: false,
    assetsDir: '',
    rollupOptions: {
      output: {
        // 'es' es obligatorio: transformDynamicImports convierte los imports de
        // los chunks en import() con la ruta del widget, y con 'iife' no hay
        // chunks ni import().
        format: 'es',
        entryFileNames: 'main.js',
        chunkFileNames: '[name].[hash].chunk.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'main.css';
          }
          return '[name].[ext]';
        },
        // Ningun chunk lazy puede importar main.js: en el preview de Modyo esa
        // URL cambia en cada request y React se cargaria varias veces. Todo lo
        // compartido sale del entry a estos chunks: dependencias, Dynamic UI y
        // el codigo transversal del widget (config/, shared/, locales/), que
        // usan tanto app/ como las paginas lazy. El orden importa: ui-react
        // tambien coincide con /node_modules/. Ver docs/code-splitting.md.
        manualChunks(id) {
          if (id.includes('@dynamic-framework/ui-react')) {
            return 'dynamic-ui-react';
          }
          if (id.includes('/node_modules/') || id.includes('vite/preload-helper')) {
            return 'vendor';
          }
          if (/\/src\/(config|shared|locales)\//.test(id)) {
            return 'app-shared';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});