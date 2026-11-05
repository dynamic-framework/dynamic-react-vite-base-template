/**
 * dynamic-a11y/require-props
 *
 * Exige props de accesibilidad en componentes según un contrato declarativo:
 *
 *   { components: { DInput: [{ oneOf: ['label', 'aria-label'] }] } }
 *
 * Cada componente tiene una lista de checks `{ when?, required?, oneOf?, hint? }`:
 *   - when.present / when.absent: el check aplica si esas props están (o no).
 *   - when.equals: el check aplica si la prop tiene ese valor literal.
 *   - required: todas deben estar.
 *   - oneOf: al menos una debe estar. Una entrada `prop=valor` exige ese valor.
 *
 * Pseudo-props (en when, required y oneOf):
 *   - `#children`: el elemento tiene hijos con contenido.
 *   - `#child:<Nombre>`: tiene un hijo <Nombre> (también dentro de fragments,
 *     `cond && <X/>` y ternarios).
 *
 * Solo se revisan los componentes importados desde `sources` (por defecto
 * `@dynamic-framework/ui-react`), así que un componente local con el mismo
 * nombre no se toca y los alias (`import { DInput as Field }`) sí se revisan.
 *
 * Una prop con valor literal `false` cuenta como ausente. Con un spread
 * (`{...props}`) no se sabe qué llega: se omiten los checks y solo se revisan
 * los valores vacíos.
 */

const DEFAULT_SOURCES = ['@dynamic-framework/ui-react'];

const UNKNOWN = Symbol('unknown');

const checkSchema = {
  type: 'object',
  properties: {
    when: {
      type: 'object',
      properties: {
        present: { type: 'array', items: { type: 'string' } },
        absent: { type: 'array', items: { type: 'string' } },
        equals: {
          type: 'object',
          additionalProperties: { type: ['string', 'number', 'boolean', 'null'] },
        },
      },
      additionalProperties: false,
    },
    required: { type: 'array', items: { type: 'string' }, minItems: 1 },
    oneOf: { type: 'array', items: { type: 'string' }, minItems: 2 },
    hint: { type: 'string' },
  },
  additionalProperties: false,
};

function attributeName(attribute) {
  const { name } = attribute;
  return name.type === 'JSXNamespacedName'
    ? `${name.namespace.name}:${name.name.name}`
    : name.name;
}

function jsxName(node) {
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') return `${jsxName(node.object)}.${node.property.name}`;
  if (node.type === 'JSXNamespacedName') return `${node.namespace.name}:${node.name.name}`;
  return null;
}

/** Valor literal de una prop: `true` si va sin valor y UNKNOWN si es una expresión. */
function literalValue(attribute) {
  const { value } = attribute;
  if (value === null) return true;
  if (value.type === 'Literal') return value.value;
  if (value.type === 'JSXExpressionContainer') {
    const { expression } = value;
    if (expression.type === 'Literal') return expression.value;
    if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) {
      return expression.quasis[0].value.cooked;
    }
  }
  return UNKNOWN;
}

function isEmpty(attribute) {
  const value = literalValue(attribute);
  return typeof value === 'string' && value.trim() === '';
}

/** Cómo se muestra una entrada del contrato en el mensaje. */
function display(entry) {
  if (entry === '#children') return 'children';
  if (entry.startsWith('#child:')) return `<${entry.slice('#child:'.length)}>`;
  const separator = entry.indexOf('=');
  return separator === -1 ? entry : `${entry.slice(0, separator)}="${entry.slice(separator + 1)}"`;
}

function hasContent(child) {
  switch (child.type) {
    case 'JSXText':
      return child.value.trim() !== '';
    case 'JSXExpressionContainer': {
      const { expression } = child;
      if (expression.type === 'JSXEmptyExpression') return false;
      if (expression.type === 'Literal') {
        return typeof expression.value === 'string' ? expression.value.trim() !== '' : false;
      }
      return true;
    }
    case 'JSXElement':
    case 'JSXFragment':
    case 'JSXSpreadChild':
      return true;
    default:
      return false;
  }
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require accessibility props on components based on a declarative contract',
    },
    schema: [{
      type: 'object',
      properties: {
        sources: { type: 'array', items: { type: 'string' }, minItems: 1 },
        components: {
          type: 'object',
          additionalProperties: { type: 'array', items: checkSchema },
        },
      },
      required: ['components'],
      additionalProperties: false,
    }],
    messages: {
      missing: '<{{component}}> requires the "{{prop}}" prop.{{hint}}',
      missingOneOf: '<{{component}}> requires at least one of: {{props}}.{{hint}}',
      empty: '<{{component}}>: "{{prop}}" must not be empty.',
    },
  },

  create(context) {
    const { sources = DEFAULT_SOURCES, components = {} } = context.options[0] ?? {};

    /** Nombre local → nombre exportado, para los imports desde `sources`. */
    const named = new Map();
    /** Nombres locales de `import * as X from ...`. */
    const namespaces = new Set();

    const fromSource = (path) => sources.some(
      (source) => path === source || path.startsWith(`${source}/`),
    );

    /** Nombre del componente en el contrato, o null si no viene de `sources`. */
    function resolve(nameNode) {
      const raw = jsxName(nameNode);
      if (!raw) return null;
      const [root, ...rest] = raw.split('.');
      if (namespaces.has(root) && rest.length > 0) return rest.join('.');
      if (named.has(root)) return [named.get(root), ...rest].join('.');
      return null;
    }

    function childMatches(child, wanted) {
      switch (child.type) {
        case 'JSXElement':
          return resolve(child.openingElement.name) === wanted;
        case 'JSXFragment':
          return child.children.some((c) => childMatches(c, wanted));
        case 'JSXExpressionContainer':
          return expressionMatches(child.expression, wanted);
        default:
          return false;
      }
    }

    function expressionMatches(expression, wanted) {
      switch (expression.type) {
        case 'JSXElement':
        case 'JSXFragment':
          return childMatches(expression, wanted);
        case 'LogicalExpression':
          return expressionMatches(expression.right, wanted);
        case 'ConditionalExpression':
          return expressionMatches(expression.consequent, wanted)
            || expressionMatches(expression.alternate, wanted);
        default:
          return false;
      }
    }

    return {
      ImportDeclaration(node) {
        if (!fromSource(node.source.value)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            const imported = specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
            named.set(specifier.local.name, imported);
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            namespaces.add(specifier.local.name);
          }
        }
      },

      JSXOpeningElement(node) {
        const component = resolve(node.name);
        const checks = component && components[component];
        if (!checks) return;

        const attributes = new Map();
        let hasSpread = false;
        for (const attribute of node.attributes) {
          if (attribute.type === 'JSXSpreadAttribute') hasSpread = true;
          else attributes.set(attributeName(attribute), attribute);
        }

        const contractProps = new Set(checks.flatMap((check) => [
          ...(check.required ?? []),
          ...(check.oneOf ?? []).map((entry) => entry.split('=')[0]),
        ]));
        for (const [prop, attribute] of attributes) {
          if ((contractProps.has(prop) || prop.startsWith('aria-')) && isEmpty(attribute)) {
            context.report({ node: attribute, messageId: 'empty', data: { component, prop } });
          }
        }

        if (hasSpread) return;

        const children = node.parent.type === 'JSXElement' ? node.parent.children : [];

        /** true / false / UNKNOWN según la prop o pseudo-prop. */
        function present(prop) {
          if (prop === '#children') return children.some(hasContent);
          if (prop.startsWith('#child:')) {
            const wanted = prop.slice('#child:'.length);
            return children.some((child) => childMatches(child, wanted));
          }
          const attribute = attributes.get(prop);
          if (!attribute) return false;
          return literalValue(attribute) !== false;
        }

        function equals(prop, expected) {
          const attribute = attributes.get(prop);
          if (!attribute) return false;
          const value = literalValue(attribute);
          return value === UNKNOWN ? UNKNOWN : value === expected;
        }

        /** Entrada de oneOf: `prop` o `prop=valor`. Un valor dinámico se da por bueno. */
        function satisfies(entry) {
          const separator = entry.indexOf('=');
          if (separator === -1) return present(entry);
          return equals(entry.slice(0, separator), entry.slice(separator + 1)) !== false;
        }

        function applies(when) {
          if (!when) return true;
          if ((when.present ?? []).some((prop) => !present(prop))) return false;
          if ((when.absent ?? []).some((prop) => present(prop))) return false;
          // Con un valor dinámico no se sabe si aplica: no se reporta.
          return Object.entries(when.equals ?? {})
            .every(([prop, expected]) => equals(prop, expected) === true);
        }

        for (const check of checks) {
          if (!applies(check.when)) continue;
          const hint = check.hint ? ` ${check.hint}` : '';

          for (const prop of check.required ?? []) {
            if (!present(prop)) {
              context.report({
                node, messageId: 'missing', data: { component, prop: display(prop), hint },
              });
            }
          }

          if (check.oneOf && !check.oneOf.some(satisfies)) {
            context.report({
              node,
              messageId: 'missingOneOf',
              data: { component, props: check.oneOf.map(display).join(', '), hint },
            });
          }
        }
      },
    };
  },
};
