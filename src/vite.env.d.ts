/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  /**
   * Nombre de montaje del widget: `data-widget`, `id` del contenedor y prefijo
   * de las clases propias. Lo inyecta el `define` de vite.config.ts a partir
   * de `name` en package.json; ver .vite/widgetName.ts.
   */
  readonly VITE_WIDGET_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
