/**
 * Entry point EXCLUSIVO para modyo-cli preview.
 * NO importar desde ningún otro archivo.
 * Los módulos /@react-refresh y /@vite/client solo existen en el dev server.
 *
 * Uso:
 *   modyo-cli preview --module --entry-js src/modyo-preview-entry.ts --port 5173 ...
 */

// 1. React Fast Refresh preamble (debe ejecutarse antes de cualquier componente React)
const RefreshRuntime = (await import('/@react-refresh')).default;
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;

// 2. Vite HMR client (WebSocket + error overlay)
await import('/@vite/client');

// 3. App entry point
await import('./main');
