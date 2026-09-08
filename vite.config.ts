/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import escapeLiquidInStrings from './.vite/plugins/escapeLiquidInStrings';
import lucideSubset from './.vite/plugins/lucideSubset';

export default defineConfig({
  plugins: [
    svgr(),
    react(),
    escapeLiquidInStrings(),
    // Reduces lucide-react to the subset of icons this widget uses.
    // Build-only; under dev and the CLI preview the full Lucide is visible.
    // include: icon names the widget computes at runtime and that do not
    //   appear as a string literal in src/. See the README.
    // strict: fails the build on icon={expression} when include is empty.
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
    assetsDir: '',
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].[hash].chunk.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'main.css';
          }
          return '[name].[ext]';
        },
        format: 'es',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});