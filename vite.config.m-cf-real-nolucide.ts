/**
 * Celda (2b) de la medición contrafactual: el bundle REAL del widget con el
 * stub de motion pero SIN lucideSubset, para aislar la aportación de motion de
 * la de los iconos.
 *
 * Parte de vite.config.m-base.ts, que es la copia congelada del vite.config.ts
 * de fix/iife-output (es decir, sin el plugin de iconos).
 *
 * Uso: npx vite build --config vite.config.m-cf-real-nolucide.ts --outDir dist-cf2b
 */
import { mergeConfig } from 'vite';

import motionStub from './.perf/motionStub';
import baseConfig from './vite.config.m-base';

export default mergeConfig(baseConfig, {
  plugins: [motionStub()],
});
