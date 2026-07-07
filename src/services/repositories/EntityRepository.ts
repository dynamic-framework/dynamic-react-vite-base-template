/**
 * EntityRepository — canonical repository example.
 *
 * Repositories are stateless as far as the app is concerned — caching and
 * loading state are TanStack Query's job. (In mock mode `createEntity` mutates
 * the in-memory fixture below; that's a mock-only convenience, not repository
 * state.) They return mocks or call the API depending on `USE_MOCKS`, and
 * translate API shapes into domain types. Mirrors the structure of
 * `src/services/api/`. Copy this file to
 * `src/services/repositories/<EntityName>Repository.ts` (PascalCase entity +
 * `Repository.ts`) and rename for your own domain — the query hook in
 * `src/hooks/useEntities.ts` shows how to consume it.
 */
import { USE_MOCKS } from '../../config/widgetConfig';
import type { ApiEntity, CreateEntityData, Entity } from '../../types';
import { api } from '../api/client';
import { mockEntities } from '../mocks/entity';

const MOCK_DELAY = 500; // ms

/**
 * Fetch the entity list.
 */
export async function getEntities(signal?: AbortSignal): Promise<Entity[]> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    signal?.throwIfAborted();
    // Return independent copies so callers can't mutate the shared fixture.
    return mockEntities.map((entity) => ({ ...entity }));
  }

  const response = await api.get<ApiEntity[]>('/entities', { signal });
  return response.data.map(mapToEntity);
}

/**
 * Create an entity.
 */
export async function createEntity(data: CreateEntityData): Promise<Entity> {
  if (USE_MOCKS) {
    await delay(MOCK_DELAY);
    const created: Entity = {
      id: `mock-${mockEntities.length + 1}`,
      ...data,
      createdAt: new Date().toISOString(),
    };
    mockEntities.push(created);
    return created;
  }

  const response = await api.post<ApiEntity>('/entities', data);
  return mapToEntity(response.data);
}

function mapToEntity(apiEntity: ApiEntity): Entity {
  return {
    id: apiEntity.id,
    name: apiEntity.name,
    createdAt: apiEntity.created_at,
    updatedAt: apiEntity.updated_at,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
