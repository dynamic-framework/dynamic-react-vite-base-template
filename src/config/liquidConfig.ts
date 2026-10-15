import { Liquid } from 'liquidjs';

import liquidParser from '../utils/liquidParser';

import liquidConfig from './liquid.json';

// El motor de Liquid y los valores de `liquid.json` solo sirven en local, y los
// dos los apaga el mismo interruptor: el plugin `stripLiquidDevConfig`
// (.vite/plugins/), que en cualquier build vacia el JSON a `{}` y define
// `__LIQUID_DEV_ENGINE__` como false.
//
// Tienen que ir juntos. Con la configuracion vacia y el motor encendido,
// `strictVariables: true` convierte `{{site.language}}` en el string
// "undefined variable: site, line:1, col:3" en vez de dejarlo intacto para que
// lo resuelva Modyo en el servidor.
//
// El flag se apoya en `command === 'build'` y no en el modo ni en
// `import.meta.env.DEV`, para que tambien cubra `vite build --mode staging` y
// `NODE_ENV=development vite build`. Ver el plugin y el README.
//
// `liquidjs` se importa de forma estatica, no con `await import()`, porque el
// formato de salida IIFE no admite top-level await y la inicializacion tiene
// que seguir siendo sincrona: `widgetConfig.ts` resuelve sus constantes en
// tiempo de modulo. Con el flag en false la condicion se pliega y liquidjs
// queda fuera del bundle por tree-shaking (declara sideEffects: false).
//
// No pongas credenciales reales en `liquid.json`: ver el README.
liquidParser.init(
  liquidConfig,
  __LIQUID_DEV_ENGINE__ ? { Liquid } : null,
);
