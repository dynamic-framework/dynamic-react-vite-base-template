/**
 * Template para Repository Pattern.
 *
 * Los repositories son funciones puras que:
 * - Llaman a la API o retornan mocks segun configuracion
 * - Transforman datos de API a tipos de dominio
 * - Soportan AbortSignal para cancelacion
 *
 * NUNCA tienen estado interno (eso es responsabilidad de TanStack Query).
 */

import { api } from '../api/client';
import { USE_MOCKS } from '../../config/widgetConfig';
import { mockEntities } from '../mocks/_template';
import type { Entity, ApiEntity, CreateEntityData, UpdateEntityData } from '../../types';

// ============================================
// CONFIGURACION
// ============================================

const MOCK_DELAY = 500; // ms

// ============================================
// FUNCIONES DE REPOSITORIO
// ============================================

/**
 * Obtiene lista de entidades.
 */
export async function getEntities(signal?: AbortSignal): Promise<Entity[]> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    return mockEntities;
  }

  const response = await api.get<ApiEntity[]>('/entities', { signal });
  return response.data.map(mapToEntity);
}

/**
 * Obtiene una entidad por ID.
 */
export async function getEntityById(id: string, signal?: AbortSignal): Promise<Entity> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const entity = mockEntities.find((e) => e.id === id);
    if (!entity) throw new Error(`Entity ${id} not found`);
    return entity;
  }

  const response = await api.get<ApiEntity>(`/entities/${id}`, { signal });
  return mapToEntity(response.data);
}

/**
 * Crea una entidad.
 */
export async function createEntity(data: CreateEntityData): Promise<Entity> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const newEntity: Entity = {
      id: `mock-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
    };
    mockEntities.push(newEntity);
    return newEntity;
  }

  const response = await api.post<ApiEntity>('/entities', data);
  return mapToEntity(response.data);
}

/**
 * Actualiza una entidad.
 */
export async function updateEntity(id: string, data: UpdateEntityData): Promise<Entity> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const index = mockEntities.findIndex((e) => e.id === id);
    if (index === -1) throw new Error(`Entity ${id} not found`);
    mockEntities[index] = { ...mockEntities[index], ...data };
    return mockEntities[index];
  }

  const response = await api.patch<ApiEntity>(`/entities/${id}`, data);
  return mapToEntity(response.data);
}

/**
 * Elimina una entidad.
 */
export async function deleteEntity(id: string): Promise<void> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const index = mockEntities.findIndex((e) => e.id === id);
    if (index !== -1) mockEntities.splice(index, 1);
    return;
  }

  await api.delete(`/entities/${id}`);
}

// ============================================
// MAPPERS
// ============================================

function mapToEntity(apiEntity: ApiEntity): Entity {
  return {
    id: apiEntity.id,
    name: apiEntity.name,
    createdAt: apiEntity.created_at,
    updatedAt: apiEntity.updated_at,
  };
}

// ============================================
// HELPERS
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
