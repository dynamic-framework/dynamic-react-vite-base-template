import { useEffect, useState } from 'react';

/**
 * Devuelve el valor pasado, retrasado por `delay` milisegundos.
 *
 * Útil para campos de búsqueda que disparan queries: el componente actualiza
 * su input cada keystroke, pero el efecto downstream (fetch, filter, etc.)
 * lee el valor debounced y solo corre tras un período de inactividad.
 *
 * Issue upstream relacionado (debounce nativo en DInput):
 *   https://github.com/dynamic-framework/dynamic-ui/issues/1051
 *
 * Cuando upstream agregue `debounceMs` a DInput, este hook puede eliminarse
 * en favor del soporte nativo.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
