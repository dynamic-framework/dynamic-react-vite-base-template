/**
 * Plugin ESLint de accesibilidad para widgets con Dynamic Framework.
 *
 * Autocontenido: no importa nada del resto del repo, para poder extraerlo a un
 * paquete propio cambiando solo el import en eslint.config.js.
 *
 *   import dynamicA11y from './eslint/dynamic-a11y/index.js';
 *   export default [...dynamicA11y.configs.recommended];
 */
import jsxA11y from 'eslint-plugin-jsx-a11y';

import contract from './contract.js';
import requireProps from './rules/require-props.js';

const FILES = ['**/*.{jsx,tsx}'];

/**
 * Componentes que pasan sus props al elemento nativo, para que jsx-a11y los
 * revise como tal. No se mapean DButton (jsx-a11y no lee `text`), DAvatar (usa
 * `name` en vez de `alt`), DListGroup.Item (cambia de elemento) ni los que
 * reciben `ariaLabel` en camelCase: esos los cubre el contrato.
 */
const NATIVE_ELEMENTS = {
  DButtonIcon: 'button',
  DInput: 'input',
  DInputMask: 'input',
  DInputCurrency: 'input',
  DInputPassword: 'input',
  DInputSearch: 'input',
  DInputPhone: 'input',
  DInputCheck: 'input',
  DInputRange: 'input',
};

const plugin = {
  meta: { name: 'dynamic-a11y' },
  rules: { 'require-props': requireProps },
};

plugin.configs = {
  recommended: [
    { ...jsxA11y.flatConfigs.recommended, files: FILES },
    {
      files: FILES,
      plugins: { 'dynamic-a11y': plugin },
      settings: { 'jsx-a11y': { components: NATIVE_ELEMENTS } },
      rules: { 'dynamic-a11y/require-props': ['error', { components: contract }] },
    },
  ],
};

export { contract };
export default plugin;
