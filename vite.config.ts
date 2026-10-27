import react from '@vitejs/plugin-react';
import path from 'path';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';
import escapeLiquidInStrings from './.vite/plugins/escapeLiquidInStrings';
import lucideSubset from './.vite/plugins/lucideSubset';
import { readPackageName, readTemplatePackageName, resolveWidgetName } from './.vite/widgetName';

// Nombre de montaje del widget, derivado de package.json. Llega a src/ como
// import.meta.env.VITE_WIDGET_NAME y a index.html como %VITE_WIDGET_NAME%.
const WIDGET_NAME = resolveWidgetName();

// Un widget creado del template y no renombrado monta con el mismo nombre que
// todos los demás: dos de ellos en una página se pisan los contenedores.
const TEMPLATE_PACKAGE_NAME = readTemplatePackageName();

if (readPackageName() === TEMPLATE_PACKAGE_NAME) {
  console.warn(
    `[widget] package.json todavía se llama "${TEMPLATE_PACKAGE_NAME}", así que el widget monta `
    + `en "${WIDGET_NAME}". Renombra "name" en package.json antes de publicar: dos widgets que `
    + 'compartan nombre de montaje se ocupan los contenedores entre sí.',
  );
}

export default defineConfig({
  plugins: [
    svgr(),
    react(),
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
        additionalData: `$widget-name: "${WIDGET_NAME}";\n`,
        quietDeps: true,
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    minify: 'esbuild',
    // Con un formato de salida distinto de 'es', Vite no puede enlazar el CSS
    // desde el chunk y lo inyecta por JS (document.createElement('style')),
    // dentro de main.js. cssCodeSplit: false lo extrae a un unico archivo, que
    // assetFileNames nombra main.css.
    cssCodeSplit: false,
    assetsDir: '',
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'main.css';
          }
          return '[name].[ext]';
        },
        // Un unico main.js: con 'iife', Vite incluye los import() dinamicos en
        // el mismo archivo y no emite chunks.
        format: 'iife',
      },
    },
  },
  define: {
    'import.meta.env.VITE_WIDGET_NAME': JSON.stringify(WIDGET_NAME),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});