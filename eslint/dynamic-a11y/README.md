# dynamic-a11y

Plugin ESLint de accesibilidad para widgets con `@dynamic-framework/ui-react`. Junta dos cosas:

1. **jsx-a11y** (`flatConfigs.recommended`), con `settings.components` para que revise como nativos los componentes de Dynamic que pasan sus props al elemento nativo.
2. **`dynamic-a11y/require-props`**: una regla que exige props de accesibilidad según un contrato declarativo por componente (`contract.js`).

La carpeta es autocontenida: no importa nada del resto del repo. Si se extrae a un paquete propio, solo cambia el import en `eslint.config.js`.

Verificado contra `@dynamic-framework/ui-react` **2.12.1**.

## Uso

```js
// eslint.config.js
import dynamicA11y from './eslint/dynamic-a11y/index.js';

export default [
  // ...
  ...dynamicA11y.configs.recommended,
];
```

## Qué exige el contrato

| Componente | Exige |
|---|---|
| `DInput`, `DInputMask`, `DInputCurrency`, `DInputSearch`, `DInputPhone`, `DInputPassword`, `DInputCounter` | `label`, `aria-label` o `aria-labelledby` |
| `DPasswordStrengthMeter` | `label` o `aria-label` |
| `DInputCheck`, `DInputRange` | `label`, `ariaLabel`, `aria-label` o `aria-labelledby` |
| `DInputSwitch`, `DInputSelect` | `label` o `ariaLabel` |
| `DSelect` | `label`, `ariaLabel` o `aria-labelledby` |
| `DDatePicker` | `inputLabel` o `inputAriaLabel` |
| `DButton` | `aria-label` si no tiene `text` ni hijos |
| `DButtonIcon` | `aria-label` o `aria-labelledby`; con `href`, `aria-label` |
| `DModal`, `DOffcanvas` | `ariaLabel` o un hijo `<DModal.Header>` / `<DOffcanvas.Header>` |
| `DTabs`, `DProgress` | `ariaLabel` o `ariaLabelledBy` |
| `DListGroup.Item` | con `onClick`: `href`, `action` o `as="button"` |
| `DIcon` | `ariaLabel` si `ariaHidden={false}` |
| `DAvatar` | `name` si tiene `image` (se usa como `alt`) |
| `DSelect`, `DInputSelect`, `DInputPhone` | `iconStartAriaLabel` / `iconEndAriaLabel` si tienen `iconStart` / `iconEnd` |

Además, las props cuyo valor por defecto está en inglés, para pasarlas con `t('...')`:

| Componente | Exige |
|---|---|
| `DAlert`, `DChip` | `closeAriaLabel` si `showClose` |
| `DPaginator` | `ariaPreviousLabel`, `ariaNextLabel` |
| `DSkeleton` | `ariaLabel` |
| `DInputPassword` | `iconEndAriaLabel` |
| `DInputCounter` | `iconStartAriaLabel`, `iconEndAriaLabel` |
| `DInputPin` | `aria-label` |
| `DDatePicker` | `inputActionAriaLabel`, `headerPrevMonthAriaLabel`, `headerNextMonthAriaLabel`; `ariaLabelInputTime` si `showTimeInput` |

Unos componentes reciben `aria-label` (los que pasan props al elemento nativo) y otros `ariaLabel`: el contrato usa el nombre que acepta cada uno.

También se reporta un valor vacío (`""`, `{""}`, ``{``}``) en cualquier `aria-*` o prop del contrato.

## Cómo decide la regla

- Solo revisa componentes importados desde `sources` (por defecto `@dynamic-framework/ui-react`). Los alias (`import { DInput as Field }`) y los imports de namespace (`<UI.DInput>`) se resuelven; un `DInput` local con el mismo nombre no se toca.
- Una prop con valor literal `false` (`showClose={false}`) cuenta como ausente. Con un valor dinámico (`showClose={canClose}`) cuenta como presente.
- Con un spread (`{...props}`) no se sabe qué llega: no se exige nada, solo se revisan los valores vacíos.

## Formato del contrato

Cada componente tiene una lista de checks:

```js
{
  DAlert: [{
    when: { present: ['showClose'] },   // también: absent: [...], equals: { prop: valor }
    required: ['closeAriaLabel'],       // todas deben estar
    hint: 'Texto que se agrega al mensaje.',
  }],
  DInput: [{ oneOf: ['label', 'aria-label', 'aria-labelledby'] }], // al menos una
}
```

- `oneOf` admite `prop=valor` para exigir un valor literal (`'as=button'`).
- Pseudo-props: `#children` (tiene hijos con contenido) y `#child:<Nombre>` (tiene un hijo `<Nombre>`, también dentro de fragments, `cond && <X />` y ternarios).

## Componentes propios del proyecto

Para exigir props a componentes del widget, agrega un bloque con su origen y sus checks:

```js
import dynamicA11y, { contract } from './eslint/dynamic-a11y/index.js';

export default [
  ...dynamicA11y.configs.recommended,
  {
    files: ['src/**/*.tsx'],
    rules: {
      'dynamic-a11y/require-props': ['error', {
        sources: ['@dynamic-framework/ui-react', '@/shared/ui'],
        components: {
          ...contract,
          SearchField: [{ oneOf: ['label', 'aria-label'] }],
        },
      }],
    },
  },
];
```

El bloque reemplaza las opciones de la regla, así que hay que incluir `contract` y el origen de Dynamic.

## Qué no cubre

Gaps de la librería que no se pueden corregir con una prop, para reportar en ui-react:

- `DCollapse`: el botón no tiene `aria-expanded` ni `aria-controls`.
- `DPopover`: el diálogo apunta con `aria-labelledby` a un id que no se renderiza.
- `DModal.Header` / `DOffcanvas.Header`: el botón de cerrar tiene `aria-label="Close"` fijo.
- `DDropdown`: el toggle por defecto tiene `aria-label="Toggle Dropdown"` fijo y los ítems no tienen `role="menuitem"`.
- `DBoxFile`: la zona de arrastre es enfocable, con `role="presentation"` y sin nombre.
- `DStepper`: no marca el paso actual (`aria-current="step"`).
- `DTooltip`: sin `withFocus` no se abre con teclado.
- `useDToast`: `closeAriaLabel` va en las opciones del hook, no en JSX, así que la regla no lo ve.

## Al subir de versión de ui-react

`__tests__/contract.test.js` falla si un componente del contrato deja de existir. Los nombres de props se revisan a mano contra los tipos (`node_modules/@dynamic-framework/ui-react/dist/types/components/**`) y se actualiza la versión de arriba.
