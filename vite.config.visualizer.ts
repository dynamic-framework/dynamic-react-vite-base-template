/**
 * Config exclusiva para el baseline de performance (rama perf/baseline-v1.2.0).
 *
 * Extiende la config real de build agregando rollup-plugin-visualizer para
 * desglosar el bundle por dependencia. No se usa en el build normal, de modo
 * que las mediciones de tamano y tiempo salen de `vite.config.ts` sin tocar.
 *
 * Uso: npx vite build --config vite.config.visualizer.ts --outDir dist-viz
 */
import { visualizer } from 'rollup-plugin-visualizer';
import { mergeConfig } from 'vite';

import baseConfig from './vite.config';

export default mergeConfig(baseConfig, {
  plugins: [
    visualizer({
      filename: '.perf/stats.json',
      template: 'raw-data',
      gzipSize: true,
      brotliSize: true,
      emitFile: false,
    }),
  ],
});
