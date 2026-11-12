/**
 * Tipos de dominio de la feature: los que usan hooks/ y ui/. La forma de la
 * API vive en api/entity.dto.ts y se traduce con entity.mapper.ts.
 */

export interface Entity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

/** Datos para crear una entidad. */
export interface CreateEntityData {
  name: string;
}

/** Filtros de la lista; forman parte de la llave de la query. */
export interface EntityFilters {
  search?: string;
}
