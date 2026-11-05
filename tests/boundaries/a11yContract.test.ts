// @vitest-environment node
/**
 * La accesibilidad se valida con eslint/dynamic-a11y (jsx-a11y + el contrato
 * de props de Dynamic), aplicado por glob desde eslint.config.js. Si el glob o
 * el orden de los bloques cambia, la regla puede apagarse sin avisar y
 * `npm run lint` sigue en verde: aquí se lintea código de prueba en las rutas
 * reales de src/ para comprobar que sigue activa.
 */
import path from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const eslint = new ESLint({ cwd: ROOT });

const IMPORTS = "import { DButton, DInput, DModal, DOffcanvas } from '@dynamic-framework/ui-react';";

async function ruleIds(filePath: string, jsx: string): Promise<string[]> {
  const code = `${IMPORTS}\n\nexport default function X() {\n  return (${jsx});\n}\n`;
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, filePath) });
  return result.messages
    .map((m) => m.ruleId ?? 'parse-error')
    .filter((id) => /^(dynamic-a11y|jsx-a11y)\/|^parse-error$/.test(id));
}

const PATHS = [
  'src/pages/X.tsx',
  'src/features/sample/ui/X.tsx',
  'src/shared/ui/X.tsx',
  'src/app/X.tsx',
];

describe('contrato de accesibilidad', () => {
  it.each(PATHS)('exige nombre accesible a un DInput en %s', async (filePath) => {
    expect(await ruleIds(filePath, '<DInput placeholder={t(\'x\')} />'))
      .toContain('dynamic-a11y/require-props');
  });

  it.each(PATHS)('acepta un DInput con label en %s', async (filePath) => {
    expect(await ruleIds(filePath, '<DInput label={t(\'x\')} />')).toEqual([]);
  });

  it('exige aria-label en un DButton solo con ícono', async () => {
    expect(await ruleIds('src/pages/X.tsx', '<DButton iconStart="X" />'))
      .toContain('dynamic-a11y/require-props');
  });

  it('exige ariaLabel o DModal.Header en un DModal', async () => {
    expect(await ruleIds('src/pages/X.tsx', '<DModal name="m"><DModal.Body /></DModal>'))
      .toContain('dynamic-a11y/require-props');
  });

  it.each([
    ['DModal con DModal.Header', `
      <DModal name="m">
        <DModal.Header showCloseButton>{t('x')}</DModal.Header>
        <DModal.Body>{t('x')}</DModal.Body>
      </DModal>`],
    ['DModal con ariaLabel', `
      <DModal name="m" ariaLabel={t('x')}>
        <DModal.Body>{t('x')}</DModal.Body>
      </DModal>`],
    ['DModal con el header dentro de un fragment', `
      <DModal name="m">
        <><DModal.Header>{t('x')}</DModal.Header></>
      </DModal>`],
    ['DModal con el header condicional (&&)', `
      <DModal name="m">
        {open && <DModal.Header>{t('x')}</DModal.Header>}
      </DModal>`],
    ['DModal con el header condicional (ternario)', `
      <DModal name="m">
        {open ? <DModal.Header>{t('x')}</DModal.Header> : null}
      </DModal>`],
    ['DModal con spread', `
      <DModal {...modalProps}>
        <DModal.Body>{t('x')}</DModal.Body>
      </DModal>`],
    ['DOffcanvas con DOffcanvas.Header', `
      <DOffcanvas name="o" openFrom="start">
        <DOffcanvas.Header showCloseButton>{t('x')}</DOffcanvas.Header>
        <DOffcanvas.Body>{t('x')}</DOffcanvas.Body>
        <DOffcanvas.Footer><DButton text={t('x')} /></DOffcanvas.Footer>
      </DOffcanvas>`],
    ['DOffcanvas con ariaLabel', `
      <DOffcanvas name="o" ariaLabel={t('x')}>
        <DOffcanvas.Body>{t('x')}</DOffcanvas.Body>
      </DOffcanvas>`],
  ])('acepta %s', async (_, jsx) => {
    expect(await ruleIds('src/pages/X.tsx', jsx)).toEqual([]);
  });

  it('aplica jsx-a11y a los componentes mapeados a un elemento nativo', async () => {
    expect(await ruleIds('src/pages/X.tsx', '<DInput label={t(\'x\')} autoComplete="nope" />'))
      .toContain('jsx-a11y/autocomplete-valid');
  });

  it('aplica jsx-a11y a los elementos nativos', async () => {
    expect(await ruleIds('src/pages/X.tsx', '<img src="x.png" />'))
      .toContain('jsx-a11y/alt-text');
  });
});
