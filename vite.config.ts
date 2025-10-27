/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import { transformDynamicImports } from './plugins/transformDynamicImports';

export default defineConfig({
  plugins: [
    svgr(),
    react(),
    transformDynamicImports()
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
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
    outDir: 'build',
    assetsDir: '',
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].chunk.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'main.css';
          }
          return '[name].[ext]';
        },
      },
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});