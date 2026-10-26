import { Liquid } from 'liquidjs';

import liquidParser from '@/shared/lib/liquidParser';

import liquidConfig from './liquid.json';

// `liquid.json` holds development-only fixtures for the liquid placeholders
// (`{{site.*}}`, `{{vars.*}}`, `{{user.*}}`) and must never ship with the
// widget: anything put there to test locally — an internal URL, a realm, a
// session token — would be published inside the bundle.
//
// Not initializing the parser is what keeps both the fixtures and the engine
// out. Uninitialized, `liquidParser` keeps `library = {}` and
// `engine = undefined`, so its `parse()` returns the tag untouched — which is
// exactly what has to travel, for Modyo to resolve it server-side.
//
// `liquidConfig` and `Liquid` are referenced only inside this block, so in a
// build the condition folds to false and tree-shaking drops both: the JSON and
// liquidjs, which declares `sideEffects: false`.
//
// liquidjs is imported statically rather than with `await import('liquidjs')`
// because the output format is `iife`, which rejects top-level await outright
// ('Module format "iife" does not support top-level await'). The initialization
// also has to stay synchronous: `widgetConfig.ts` resolves its constants at
// module evaluation time.
//
// Caveat: `import.meta.env.DEV` means "NODE_ENV is not production", not "this is
// a build". `NODE_ENV=development vite build` therefore leaves this block in and
// publishes `liquid.json`. Every `--mode` is covered (DEV is false for all of
// them); only an inherited NODE_ENV is not.
//
// Never put real credentials in `liquid.json`.
if (import.meta.env.DEV) {
  liquidParser.init(liquidConfig, { Liquid });
}
