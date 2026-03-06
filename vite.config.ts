/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    svgr(),
    react(),
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
    outDir: 'build',
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