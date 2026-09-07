import { Liquid } from 'liquidjs';

import liquidParser from '../utils/liquidParser';

import liquidConfig from './liquid.json';

// El motor de Liquid solo se usa fuera de produccion. Se importa de forma
// estatica en vez de con `await import('liquidjs')` porque el formato de salida
// IIFE no admite top-level await ('Module format "iife" does not support
// top-level await'). En el build de produccion `import.meta.env.MODE` se
// reemplaza por "production", la condicion se pliega a false y liquidjs queda
// fuera del bundle por tree-shaking (el paquete declara sideEffects: false).
// La inicializacion sigue siendo sincrona, que es lo que necesita
// widgetConfig.ts: sus constantes se resuelven en tiempo de modulo.
liquidParser.init(
  liquidConfig,
  import.meta.env.MODE !== 'production' ? { Liquid } : null,
);
