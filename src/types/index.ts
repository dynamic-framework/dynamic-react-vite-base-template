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
