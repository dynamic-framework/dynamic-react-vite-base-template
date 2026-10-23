/**
 * Tipos centralizados del widget.
 *
 * Convenciones:
 * - Entity: Tipo de dominio (usado en componentes)
 * - ApiEntity: Tipo de respuesta de API (usado solo en repositories)
 * - CreateEntityData: Payload para crear
 * - UpdateEntityData: Payload para actualizar (campos opcionales)
 */

// ============================================
// DOMAIN TYPES
// ============================================

export interface Entity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// API TYPES
// ============================================

export interface ApiEntity {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

// ============================================
// MODYO SESSION TYPES
// ============================================

/**
 * Delegated token Modyo issues for the signed-in customer, returned inside the
 * `/api/customers/realms/{realm}/me` payload.
 *
 * Every time field is **deliberately optional**. This is the payload of a
 * platform the widget does not own: if one were missing and the type declared it
 * required, the staleTime computation would silently yield `NaN`. Optional
 * forces the caller to handle the absence.
 *
 * - `revalidate_in`: seconds until `/me` has to be asked again. Modyo recomputes
 *   it on every response as `expiry - skew - now`, so it is already the
 *   remaining life, not the original lifetime.
 * - `access_token_expires_in`: the token's full lifetime in seconds.
 * - `access_token_expires_in_datetime`: absolute expiry, on the server clock.
 */
export interface DelegatedToken {
  uuid?: string;
  access_token: string;
  access_token_expires_in?: number;
  access_token_expires_in_datetime?: string;
  revalidate_in?: number;
}

/**
 * Profile returned by `/me`. `delegated_token` is optional: whether Modyo mints
 * one depends on an identity provider flag the widget does not control, so its
 * absence is a case to handle explicitly, not a bug.
 */
export interface ModyoProfile {
  uuid?: string;
  username?: string;
  name?: string;
  email?: string;
  delegated_token?: DelegatedToken;
}

// ============================================
// PAYLOAD TYPES
// ============================================

export interface CreateEntityData {
  name: string;
}

export interface UpdateEntityData {
  name?: string;
}

// ============================================
// FILTER TYPES
// ============================================

export interface EntityFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}
