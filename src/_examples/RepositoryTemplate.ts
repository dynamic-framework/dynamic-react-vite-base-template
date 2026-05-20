/**
 * Repository Template — Reference Example
 *
 * This file is a reference scaffold. To use:
 *   1. Copy this file to `src/services/repositories/<entityName>.ts`
 *      (convention: PascalCase entity, e.g. `Account.ts`, `Policy.ts`)
 *   2. Rename `Entity`/`mockEntities` references to your actual entity
 *   3. Update the endpoint paths (`/entities`) to your API surface
 *   4. Adjust the mapper to translate API shape → domain shape
 *
 * Repositories are pure functions that:
 * - Call the API or return mocks depending on configuration
 * - Transform API data to domain types
 * - Support AbortSignal for cancellation
 *
 * They NEVER hold internal state (that's TanStack Query's job).
 *
 * The relative imports below already match the destination location
 * (`src/services/repositories/`), not the current location of this file
 * in `src/_examples/`. After copying, no path adjustments are needed.
 *
 * This file is excluded from TypeScript compilation
 * (see tsconfig.app.json `exclude`).
 */

import { api } from '../api/client';
import { USE_MOCKS } from '../../config/widgetConfig';
import { mockEntities } from '../mocks/<entityName>';
import type { Entity, ApiEntity, CreateEntityData, UpdateEntityData } from '../../types';

// ============================================
// CONFIGURATION
// ============================================

const MOCK_DELAY = 500; // ms

// ============================================
// REPOSITORY FUNCTIONS
// ============================================

/**
 * Fetch the entity list.
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
 * Fetch a single entity by ID.
 */
export async function getEntityById(id: string, signal?: AbortSignal): Promise<Entity> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const entity = mockEntities.find((e: Entity) => e.id === id);
    if (!entity) throw new Error(`Entity ${id} not found`);
    return entity;
  }

  const response = await api.get<ApiEntity>(`/entities/${id}`, { signal });
  return mapToEntity(response.data);
}

/**
 * Create an entity.
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
 * Update an entity.
 */
export async function updateEntity(id: string, data: UpdateEntityData): Promise<Entity> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const index = mockEntities.findIndex((e: Entity) => e.id === id);
    if (index === -1) throw new Error(`Entity ${id} not found`);
    mockEntities[index] = { ...mockEntities[index], ...data };
    return mockEntities[index];
  }

  const response = await api.patch<ApiEntity>(`/entities/${id}`, data);
  return mapToEntity(response.data);
}

/**
 * Delete an entity.
 */
export async function deleteEntity(id: string): Promise<void> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const index = mockEntities.findIndex((e: Entity) => e.id === id);
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
