/**
 * Celda (4) con rollup-plugin-visualizer, para el desglose por paquete.
 *
 * Extiende vite.config.visualizer.ts (que a su vez extiende vite.config.ts con
 * el visualizer) añadiendo el stub de motion. Solo del rig.
 *
 * Uso: npx vite build --config vite.config.m-cf-viz.ts --outDir dist-cf-viz4
 */
import { mergeConfig } from 'vite';

import motionStub from './.perf/motionStub';
import visualizerConfig from './vite.config.visualizer';

export default mergeConfig(visualizerConfig, {
  plugins: [motionStub()],
});
