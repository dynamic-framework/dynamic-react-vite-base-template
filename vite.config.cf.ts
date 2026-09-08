/**
 * Config para los builds contrafactuales (rama perf/baseline-v1.2.0).
 *
 * Es vite.config.perf.ts parametrizada por variables de entorno, para poder
 * construir la misma entrada en directorios distintos y con o sin el alias de
 * resolve que usa el template:
 *
 *   CF_ENTRY  entry a construir       (default .perf/widget-entry.tsx)
 *   CF_OUT    directorio de salida    (default dist-cf)
 *   CF_ALIAS  '0' quita el alias de '@dynamic-framework/ui-react'
 *
 * Todo lo demas (plugins, minify, formato, nombres de salida) es identico a
 * vite.config.perf.ts, que a su vez replica vite.config.ts.
 */
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import { visualizer } from 'rollup-plugin-visualizer';
import escapeLiquidInStrings from './.vite/plugins/escapeLiquidInStrings';

const entry = process.env.CF_ENTRY ?? '.perf/widget-entry.tsx';
const out = process.env.CF_OUT ?? 'dist-cf';
const withAlias = process.env.CF_ALIAS !== '0';

export default defineConfig({
  plugins: [
    svgr(),
    react(),
    escapeLiquidInStrings(),
    // CF_VIZ=<ruta> emite el grafo del bundle (raw-data) para el desglose por paquete.
    ...(process.env.CF_VIZ
      ? [visualizer({ filename: process.env.CF_VIZ, template: 'raw-data', gzipSize: true, brotliSize: true })]
      : []),
  ],
  resolve: {
    alias: {
      ...(withAlias
        ? {
          '@dynamic-framework/ui-react':
            path.resolve(__dirname, 'node_modules/@dynamic-framework/ui-react'),
        }
        : {}),
      'node_modules/bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
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
    outDir: out,
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    minify: 'esbuild',
    assetsDir: '',
    rollupOptions: {
      // CF_SIDEEFFECTS=0 fuerza moduleSideEffects:false para ui-react desde
      // Rollup, ignorando lo que diga su package.json. Es el diagnostico de si
      // la retencion viene de los efectos secundarios del modulo.
      ...(process.env.CF_SIDEEFFECTS === '0'
        ? {
          treeshake: {
            moduleSideEffects: (id: string) => !/@dynamic-framework[/\\]ui-react/.test(id) || id.endsWith('.css'),
          },
        }
        : {}),
      input: path.resolve(__dirname, entry),
      output: {
        entryFileNames: 'widget.js',
        chunkFileNames: '[name].[hash].chunk.js',
        assetFileNames: (assetInfo) => (assetInfo.name?.endsWith('.css') ? 'widget.css' : '[name].[ext]'),
        format: 'es',
      },
    },
  },
});
