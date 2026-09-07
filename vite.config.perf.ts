/**
 * Config exclusiva para el harness de runtime del baseline
 * (rama perf/baseline-v1.2.0).
 *
 * Construye .perf/widget-entry.tsx como un bundle único `widget.js` con los
 * mismos ajustes de build que vite.config.ts (minify esbuild, formato es,
 * sin code split, sin externals). El harness copia ese bundle a URLs distintas
 * para simular N widgets independientes servidos por el widget manager.
 *
 * Uso: npx vite build --config vite.config.perf.ts
 */
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import escapeLiquidInStrings from './.vite/plugins/escapeLiquidInStrings';

export default defineConfig({
  plugins: [
    svgr(),
    react(),
    escapeLiquidInStrings(),
  ],
  resolve: {
    alias: {
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
    outDir: 'dist-perf',
    chunkSizeWarningLimit: 2000,
    minify: 'esbuild',
    assetsDir: '',
    rollupOptions: {
      input: path.resolve(__dirname, '.perf/widget-entry.tsx'),
      output: {
        entryFileNames: 'widget.js',
        chunkFileNames: '[name].[hash].chunk.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'widget.css';
          }
          return '[name].[ext]';
        },
        format: 'es',
      },
    },
  },
});
