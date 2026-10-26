/**
 * Tipos de dominio de la feature entities.
 *
 * Convenciones:
 * - Entity: Tipo de dominio (usado en componentes)
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
