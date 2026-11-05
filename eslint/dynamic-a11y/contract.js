/**
 * Contrato de accesibilidad de @dynamic-framework/ui-react.
 *
 * Verificado contra los tipos de ui-react 2.12.1. Al subir de versión, revisar
 * que cada prop siga existiendo con el mismo nombre: unos componentes reciben
 * `aria-label` (los que pasan props al elemento nativo) y otros `ariaLabel`.
 *
 * Formato de cada check: ver rules/require-props.js.
 */

const I18N = 'Pass it with t(\'...\'): the default value is hardcoded in English.';

/** Campos que hacen spread al <input>: aceptan aria-label y aria-labelledby. */
const NATIVE_INPUT_NAME = { oneOf: ['label', 'aria-label', 'aria-labelledby'] };

const iconLabel = (side) => ({
  when: { present: [`icon${side}`] },
  required: [`icon${side}AriaLabel`],
  hint: 'The icon renders as a button and has no default accessible name.',
});

const closeLabel = {
  when: { present: ['showClose'] },
  required: ['closeAriaLabel'],
  hint: I18N,
};

export default {
  // ─── Botones ──────────────────────────────────────────────────────────
  DButton: [{
    when: { absent: ['text', '#children'] },
    required: ['aria-label'],
    hint: 'An icon-only button needs an accessible name.',
  }],
  DButtonIcon: [
    { oneOf: ['aria-label', 'aria-labelledby'] },
    {
      when: { present: ['href'] },
      required: ['aria-label'],
      hint: 'With href it renders an <a> that only receives aria-label.',
    },
  ],

  // ─── Campos de formulario ─────────────────────────────────────────────
  DInput: [NATIVE_INPUT_NAME],
  DInputMask: [NATIVE_INPUT_NAME],
  DInputCurrency: [NATIVE_INPUT_NAME],
  DInputSearch: [NATIVE_INPUT_NAME],
  DInputPassword: [
    NATIVE_INPUT_NAME,
    { required: ['iconEndAriaLabel'], hint: I18N },
  ],
  DInputCounter: [
    NATIVE_INPUT_NAME,
    { required: ['iconStartAriaLabel', 'iconEndAriaLabel'], hint: I18N },
  ],
  DInputPhone: [NATIVE_INPUT_NAME, iconLabel('End')],
  DPasswordStrengthMeter: [{ oneOf: ['label', 'aria-label'] }],
  DInputCheck: [{ oneOf: ['label', 'ariaLabel', 'aria-label', 'aria-labelledby'] }],
  DInputRange: [{ oneOf: ['label', 'ariaLabel', 'aria-label', 'aria-labelledby'] }],
  DInputSwitch: [{ oneOf: ['label', 'ariaLabel'] }],
  DInputSelect: [{ oneOf: ['label', 'ariaLabel'] }, iconLabel('Start'), iconLabel('End')],
  DSelect: [
    { oneOf: ['label', 'ariaLabel', 'aria-labelledby'] },
    iconLabel('Start'),
    iconLabel('End'),
  ],
  DInputPin: [{ required: ['aria-label'], hint: I18N }],
  DDatePicker: [
    { oneOf: ['inputLabel', 'inputAriaLabel'] },
    {
      required: ['inputActionAriaLabel', 'headerPrevMonthAriaLabel', 'headerNextMonthAriaLabel'],
      hint: I18N,
    },
    { when: { present: ['showTimeInput'] }, required: ['ariaLabelInputTime'], hint: I18N },
  ],

  // ─── Diálogos ─────────────────────────────────────────────────────────
  DModal: [{
    oneOf: ['ariaLabel', '#child:DModal.Header'],
    hint: 'Without either, aria-labelledby points to an id that does not exist.',
  }],
  DOffcanvas: [{
    oneOf: ['ariaLabel', '#child:DOffcanvas.Header'],
    hint: 'Without either, aria-labelledby points to an id that does not exist.',
  }],

  // ─── Navegación y estado ──────────────────────────────────────────────
  DTabs: [{ oneOf: ['ariaLabel', 'ariaLabelledBy'] }],
  DProgress: [{
    oneOf: ['ariaLabel', 'ariaLabelledBy'],
    hint: 'Without them it is announced as "Progress bar".',
  }],
  DPaginator: [{ required: ['ariaPreviousLabel', 'ariaNextLabel'], hint: I18N }],
  DSkeleton: [{ required: ['ariaLabel'], hint: I18N }],
  'DListGroup.Item': [{
    when: { present: ['onClick'] },
    oneOf: ['href', 'action', 'as=button'],
    hint: 'Otherwise the click handler lands on an <li> that is not keyboard accessible.',
  }],

  // ─── Contenido ────────────────────────────────────────────────────────
  DIcon: [{
    when: { equals: { ariaHidden: false } },
    required: ['ariaLabel'],
    hint: 'An icon exposed to screen readers needs an accessible name.',
  }],
  DAvatar: [{
    when: { present: ['image'] },
    required: ['name'],
    hint: 'name is used as the image alt text.',
  }],
  DAlert: [closeLabel],
  DChip: [closeLabel],
};
