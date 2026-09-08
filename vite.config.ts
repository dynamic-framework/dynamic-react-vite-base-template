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
    // Reduce lucide-react al subconjunto de iconos que este widget usa.
    // Solo actua en build; en dev y en el preview del CLI se ve Lucide entero.
    // include: nombres de icono que el widget calcula en runtime y que no
    //   aparecen como string literal en src/. Ver README.
    // strict: falla el build si hay icon={expresion} y include esta vacio.
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
    // Con un formato de salida distinto de 'es', Vite no puede enlazar el CSS
    // desde el chunk y lo inyecta por JS (document.createElement('style')), lo
    // que mete 1,28 MB de CSS dentro de main.js. cssCodeSplit: false lo vuelve
    // a extraer a un unico archivo, que assetFileNames nombra main.css.
    cssCodeSplit: false,
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
        format: 'iife',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});