import './liquidConfig';

import type { CurrencyProps, DContextProvider } from '@dynamic-framework/ui-react';
import type { ComponentProps } from 'react';

import liquidParser from '@/shared/lib/liquidParser';

// ─── Registro de obligatorias ────────────────────────────────────────────
//
// El archivo se organiza por bloques: el núcleo y uno por módulo opcional.
// Cada bloque declara sus variables Liquid; las que el widget necesita para
// funcionar se declaran con requireVariable(), que las registra como
// obligatorias. Quitar un módulo es borrar su bloque.
//
// El nombre va sin llaves y el tag se escribe literal en liquidParser.parse():
// Modyo sustituye cada `{{...}}` que encuentra en el bundle, incluido uno que
// solo sirviera para mostrar el nombre. tests/config/widgetConfig.test.ts
// comprueba que nombre y tag coinciden.

export interface RequiredVariable {
  /** Como se declara en Modyo, sin llaves: `vars.api-base-url`. */
  name: string;
  value: string;
}

const requiredVariables: RequiredVariable[] = [];

/** Registra la variable como obligatoria y devuelve su valor. */
function requireVariable(name: string, value: string): string {
  requiredVariables.push({ name, value });
  return value;
}

/** Conserva el tag Liquid: Modyo no lo procesó. */
function hasLiquidTag(value: string): boolean {
  return value.includes('{{') && value.includes('}}');
}

/** Vacía o con el tag Liquid tal cual: Modyo no la resolvió. */
export function isUnresolved(value: string): boolean {
  return !value.trim() || hasLiquidTag(value);
}

/** Nombres de las variables sin resolver; con mocks activos no se exige ninguna. */
export function findMissingVariables(
  variables: readonly RequiredVariable[],
  useMocks: boolean,
): string[] {
  if (useMocks) {
    return [];
  }
  return variables.filter(({ value }) => isUnresolved(value)).map(({ name }) => name);
}

// ─── Núcleo ──────────────────────────────────────────────────────────────

export const DEFAULT_LANGUAGE = 'es';

export function resolveSiteLanguage(raw: string): string {
  return isUnresolved(raw) ? DEFAULT_LANGUAGE : raw.trim();
}

export const SITE_LANG = resolveSiteLanguage(liquidParser.parse('{{site.language}}'));
export const SITE_NAME = liquidParser.parse('{{site.name}}');

export type RawCurrency = Record<keyof CurrencyProps, string>;

/**
 * Formato de moneda del sitio. Si alguna variable llega sin resolver (o la
 * precisión no es un número), devuelve undefined y Dynamic usa su formato por
 * defecto.
 *
 * El separador de miles puede ser un espacio (normal, NBSP o NBSP estrecho):
 * solo cuenta como sin resolver si llega vacío o con el tag Liquid.
 */
export function resolveCurrency(raw: RawCurrency): CurrencyProps | undefined {
  const { separator, ...rest } = raw;
  if (Object.values(rest).some(isUnresolved) || !separator || hasLiquidTag(separator)) {
    return undefined;
  }
  const precision = Number(raw.precision);
  if (!Number.isInteger(precision) || precision < 0) {
    return undefined;
  }
  return {
    symbol: raw.symbol,
    precision,
    separator: raw.separator,
    decimal: raw.decimal,
  };
}

export const VARS_CURRENCY = resolveCurrency({
  symbol: liquidParser.parse('{{vars.currency-symbol}}'),
  precision: liquidParser.parse('{{vars.currency-precision}}'),
  separator: liquidParser.parse('{{vars.currency-separator}}'),
  decimal: liquidParser.parse('{{vars.currency-decimal}}'),
});

type ContextConfig = Partial<ComponentProps<typeof DContextProvider>>;

/**
 * Sin moneda resuelta, `currency` no aparece como clave: setContext() mezcla
 * con el contexto anterior y un `currency: undefined` borraría el de Dynamic.
 */
export function buildContextConfig(
  language: string,
  currency: CurrencyProps | undefined,
): ContextConfig {
  return currency ? { language, currency } : { language };
}

export const CONTEXT_CONFIG = buildContextConfig(SITE_LANG, VARS_CURRENCY);

// Configuración de la API
export const API_BASE_URL = requireVariable('vars.api-base-url', liquidParser.parse('{{vars.api-base-url}}'));
export const USE_MOCKS = liquidParser.parse('{{vars.use-mocks}}') === 'true';

export const widgetConfig = {
  apiBaseUrl: API_BASE_URL,
  useMocks: USE_MOCKS,
  siteLang: SITE_LANG,
  siteName: SITE_NAME,
};

// ─── Consulta ────────────────────────────────────────────────────────────
//
// Funciones y no constantes: se evalúan cuando se llaman, así que un bloque
// pegado en cualquier punto debajo del registro ya está registrado. Encima del
// registro, requiredVariables aún no existe y el módulo falla al cargar.

export function getRequiredVariables(): readonly RequiredVariable[] {
  return [...requiredVariables];
}

export function getMissingVariables(): string[] {
  return findMissingVariables(requiredVariables, USE_MOCKS);
}
