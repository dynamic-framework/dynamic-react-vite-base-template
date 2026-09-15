import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';
import svgr from 'vite-plugin-svgr';
import transformDynamicImports from '@dynamic-framework/vite-plugin-transform-dynamic-imports';
import escapeLiquidInStrings from './.vite/plugins/escapeLiquidInStrings';
import lucideSubset from './.vite/plugins/lucideSubset';

export default defineConfig({
  plugins: [
    svgr(),
    react(),
    transformDynamicImports(),
    escapeLiquidInStrings(), // Necessary to avoid Liquid syntax errors when using Liquid in strings
    lucideSubset(),
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
    chunkSizeWarningLimit: 2000,
    assetsDir: '',
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].[hash].chunk.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names && assetInfo.names.includes('.css')) {
            return '[name].css';
          }
          return '[name].[ext]';
        },
        format: 'es',
        manualChunks(id) {
          if (id.includes('@dynamic-framework/ui-react')) {
            return 'dynamic-ui-react';
          }
          if (id.includes('/node_modules/') || id.includes('vite/preload-helper')) {
            return 'vendor';
          }
        },
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});