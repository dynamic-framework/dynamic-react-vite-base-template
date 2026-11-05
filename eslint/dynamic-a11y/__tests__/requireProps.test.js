// @vitest-environment node
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';

import rule from '../rules/require-props.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const DS = "import { DButton, DInput, DModal, DIcon, DListGroup, DAlert } from '@dynamic-framework/ui-react';";

const options = [{
  components: {
    DInput: [{ oneOf: ['label', 'aria-label'] }],
    DButton: [{
      when: { absent: ['text', '#children'] },
      required: ['aria-label'],
      hint: 'Ícono solo.',
    }],
    DModal: [{ oneOf: ['ariaLabel', '#child:DModal.Header'] }],
    'DModal.Body': [{ required: ['id'] }],
    DIcon: [{ when: { equals: { ariaHidden: false } }, required: ['ariaLabel'] }],
    'DListGroup.Item': [{ when: { present: ['onClick'] }, oneOf: ['href', 'action', 'as=button'] }],
    DAlert: [{ when: { present: ['showClose'] }, required: ['closeAriaLabel'] }],
  },
}];

const code = (jsx) => `${DS}\nconst x = ${jsx};`;

ruleTester.run('dynamic-a11y/require-props', rule, {
  valid: [
    // oneOf / required
    { code: code('<DInput label="Nombre" />'), options },
    { code: code('<DInput aria-label={t("buscar")} />'), options },

    // when.absent con texto o hijos
    { code: code('<DButton text="Guardar" />'), options },
    { code: code('<DButton>{t("guardar")}</DButton>'), options },
    { code: code('<DButton iconStart="X" aria-label="Cerrar" />'), options },

    // #child, también dentro de fragments y condicionales
    { code: code('<DModal name="m"><DModal.Header /><DModal.Body id="b" /></DModal>'), options },
    { code: code('<DModal name="m"><><DModal.Header /></></DModal>'), options },
    { code: code('<DModal name="m">{open && <DModal.Header />}</DModal>'), options },
    { code: code('<DModal name="m" ariaLabel="Detalle" />'), options },

    // when.equals: solo aplica con el literal exacto o si no se puede saber
    { code: code('<DIcon icon="X" />'), options },
    { code: code('<DIcon icon="X" ariaHidden={hidden} />'), options },
    { code: code('<DIcon icon="X" ariaHidden={false} ariaLabel="Alerta" />'), options },

    // oneOf con valor (as=button); un valor dinámico se da por bueno
    { code: code('<DListGroup.Item onClick={f} as="button" />'), options },
    { code: code('<DListGroup.Item onClick={f} as={tag} />'), options },
    { code: code('<DListGroup.Item onClick={f} action />'), options },
    { code: code('<DListGroup.Item />'), options },

    // prop={false} cuenta como ausente
    { code: code('<DAlert showClose={false} />'), options },

    // spread: no se puede saber qué llega
    { code: code('<DInput {...props} />'), options },

    // Componentes que no vienen del DS no se revisan
    {
      code: "import DInput from './DInput';\nconst x = <DInput />;",
      options,
    },
    { code: 'const x = <DInput />;', options },
  ],

  invalid: [
    {
      code: code('<DInput placeholder="Buscar" />'),
      options,
      errors: [{
        messageId: 'missingOneOf',
        data: { component: 'DInput', props: 'label, aria-label', hint: '' },
      }],
    },
    {
      code: code('<DButton iconStart="X" />'),
      options,
      errors: [{
        messageId: 'missing',
        data: { component: 'DButton', prop: 'aria-label', hint: ' Ícono solo.' },
      }],
    },
    {
      code: code('<DButton iconStart="X">{" "}</DButton>'),
      options,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: code('<DModal name="m"><DModal.Body id="b" /></DModal>'),
      options,
      errors: [{
        messageId: 'missingOneOf',
        data: { component: 'DModal', props: 'ariaLabel, <DModal.Header>', hint: '' },
      }],
    },
    {
      // Nombre con puntos
      code: code('<DModal name="m" ariaLabel="x"><DModal.Body /></DModal>'),
      options,
      errors: [{ messageId: 'missing', data: { component: 'DModal.Body', prop: 'id', hint: '' } }],
    },
    {
      code: code('<DIcon icon="X" ariaHidden={false} />'),
      options,
      errors: [{ messageId: 'missing', data: { component: 'DIcon', prop: 'ariaLabel', hint: '' } }],
    },
    {
      code: code('<DListGroup.Item onClick={f} as="li" />'),
      options,
      errors: [{
        messageId: 'missingOneOf',
        data: { component: 'DListGroup.Item', props: 'href, action, as="button"', hint: '' },
      }],
    },
    {
      // Prop sin valor y valor dinámico cuentan como presentes
      code: code('<><DAlert showClose /><DAlert showClose={canClose} /></>'),
      options,
      errors: [{ messageId: 'missing' }, { messageId: 'missing' }],
    },
    {
      // Vacío: se reporta aunque haya spread, y no se duplica como faltante
      code: code('<><DInput aria-label="" /><DInput label={``} {...props} /><DInput label={" "} /></>'),
      options,
      errors: [
        { messageId: 'empty', data: { component: 'DInput', prop: 'aria-label' } },
        { messageId: 'empty', data: { component: 'DInput', prop: 'label' } },
        { messageId: 'empty', data: { component: 'DInput', prop: 'label' } },
      ],
    },
    {
      // Alias de import
      code: "import { DInput as Field } from '@dynamic-framework/ui-react';\nconst x = <Field />;",
      options,
      errors: [{ messageId: 'missingOneOf', data: { component: 'DInput', props: 'label, aria-label', hint: '' } }],
    },
    {
      // Import de namespace
      code: "import * as Dyn from '@dynamic-framework/ui-react';\nconst x = <Dyn.DInput />;",
      options,
      errors: [{ messageId: 'missingOneOf' }],
    },
    {
      // sources configurable: componentes propios del proyecto
      code: "import { MyField } from '@/shared/ui';\nconst x = <MyField />;",
      options: [{ sources: ['@/shared/ui'], components: { MyField: [{ required: ['label'] }] } }],
      errors: [{ messageId: 'missing', data: { component: 'MyField', prop: 'label', hint: '' } }],
    },
  ],
});
