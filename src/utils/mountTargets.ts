/**
 * Devuelve los contenedores donde se monta el widget `name`, en orden del
 * documento: todos los `[data-widget="<name>"]` sin `data-mounted`; si no hay
 * ninguno, el elemento con `id` igual a `name` cuando existe y no tiene
 * `data-mounted`; si tampoco, una lista vacía.
 */
export function resolveMountTargets(doc: Document, name: string): Element[] {
  const byAttribute = Array.from(doc.querySelectorAll('[data-widget]:not([data-mounted])'))
    .filter((node) => node.getAttribute('data-widget') === name);
  if (byAttribute.length > 0) {
    return byAttribute;
  }

  const byId = doc.getElementById(name);
  if (byId && !byId.hasAttribute('data-mounted')) {
    return [byId];
  }
  return [];
}
