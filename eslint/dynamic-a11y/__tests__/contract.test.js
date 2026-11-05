// @vitest-environment node
/**
 * El contrato nombra componentes de @dynamic-framework/ui-react. Si una versión
 * nueva renombra o quita uno, su entrada deja de aplicar sin avisar: aquí se
 * comprueba que cada nombre sigue existiendo en la versión instalada.
 */
import * as UI from '@dynamic-framework/ui-react';
import { describe, expect, it } from 'vitest';

import contract from '../contract.js';

describe('contract.js', () => {
  it.each(Object.keys(contract))('%s existe en @dynamic-framework/ui-react', (name) => {
    const component = name.split('.').reduce((parent, key) => parent?.[key], UI);
    expect(component).toBeDefined();
  });
});
