/// <reference types="vite-plugin-svgr/client" />

/**
 * Lo define el plugin `stripLiquidDevConfig` (.vite/plugins/): `false` en
 * cualquier build, `true` al servir en local y bajo vitest.
 */
declare const __LIQUID_DEV_ENGINE__: boolean;
