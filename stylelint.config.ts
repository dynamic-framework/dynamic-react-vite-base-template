import type { Config } from 'stylelint';

import { resolveWidgetName } from './.vite/widgetName.ts';

/**
 * El patrón de clases propias se deriva de `name` en package.json, con la
 * misma función que da el nombre de montaje del widget. Así, renombrar
 * package.json hace que Stylelint exija el renombre de src/styles/base.scss en
 * lugar de dejar los dos nombres divergiendo en silencio.
 *
 * Este archivo es .ts, y no .json, para poder importar esa función: Stylelint
 * transpila el config y Node resuelve el import (de ahí la extensión .ts
 * explícita, que Node ESM necesita).
 */

const WIDGET_NAME = resolveWidgetName();
const SEGMENT = '[a-z0-9]+(-[a-z0-9]+)*';

const config: Config = {
  "extends": [
    "stylelint-config-twbs-bootstrap"
  ],
  "reportInvalidScopeDisables": true,
  "reportNeedlessDisables": true,
  "rules": {
    "color-no-hex": [
      true,
      {
        "message": "No se permiten colores hex: usa var(--bs-*) de Dynamic, por ejemplo rgb(var(--bs-primary-rgb)). El color lo pone el theme del sitio."
      }
    ],
    "color-named": [
      "never",
      {
        "message": "No se permiten colores con nombre: usa var(--bs-*) de Dynamic, por ejemplo var(--bs-body-color). El color lo pone el theme del sitio."
      }
    ],
    "property-disallowed-list": [
      [
        "font",
        "font-family",
        "border-radius",
        "/^border-.*-radius$/"
      ],
      {
        "message": "La tipografía y los radios vienen del theme: usa las clases de Dynamic (fs-*, fw-*, rounded-*) o propiedades sueltas con var(--bs-*), como font-size: var(--bs-body-font-size)."
      }
    ],
    "at-rule-disallowed-list": [
      [
        "import"
      ],
      {
        "message": "@import no se permite: usa @use para parciales propios. El CSS de Dynamic y el theme los carga el sitio."
      }
    ]
  },
  "overrides": [
    {
      "files": [
        "**/*.scss"
      ],
      "rules": {
        "scss/no-dollar-variables": [
          true,
          {
            "message": "No se permiten variables SCSS: usa custom properties var(--bs-*) de Dynamic, que el sitio puede ajustar desde :root."
          }
        ],
        "declaration-property-value-disallowed-list": [
          {
            "border": [
              "none"
            ],
            "outline": [
              "none"
            ],
            "/.*/": [
              "/\\$[a-z]/"
            ]
          },
          {
            "message": "Valor no permitido: en lugar de variables SCSS ($x) usa var(--bs-*) de Dynamic, y escribe border y outline con 0 en lugar de none."
          }
        ],
        "function-disallowed-list": [
          "lighten",
          "darken"
        ],
        "scss/dollar-variable-default": [
          true,
          {
            "ignore": "local"
          }
        ],
        "scss/selector-no-union-class-name": true
      }
    }
  ]
};

config.rules!['selector-class-pattern'] = [
  `^${WIDGET_NAME}(__${SEGMENT})?(--${SEGMENT})?$`,
  {
    message:
      `Las clases propias siguen el patrón .${WIDGET_NAME}__bloque--variante, derivado de `
      + '"name" en package.json. Para el resto usa las utilidades de Dynamic.',
  },
];

export default config;
