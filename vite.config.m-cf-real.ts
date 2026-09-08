/**
 * Celda (4) de la medición contrafactual de framer-motion: el bundle REAL del
 * widget (src/main.tsx) con la configuración de producción del template más el
 * stub de motion.
 *
 * Extiende vite.config.ts con mergeConfig, así que hereda lucideSubset y el
 * resto de la config sin duplicarla. Solo del rig; no se registra en
 * vite.config.ts.
 *
 * Uso: npx vite build --config vite.config.m-cf-real.ts --outDir dist-cf4
 */
import { mergeConfig } from 'vite';

import motionStub from './.perf/motionStub';
import baseConfig from './vite.config';

export default mergeConfig(baseConfig, {
  plugins: [motionStub()],
});
