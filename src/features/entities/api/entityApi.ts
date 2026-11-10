/**
 * Funciones de API de la feature: una por endpoint.
 *
 * Cada función recibe un `AbortSignal` opcional (TanStack Query pasa el suyo
 * para cancelar la petición cuando la query deja de usarse) y devuelve tipos
 * de dominio: el dto no sale de api/. Con `USE_MOCKS` (vars.use-mocks)
 * responde con los datos de entity.mock.ts tras una espera cancelable, sin
 * tocar la red.
 */
import { USE_MOCKS } from '@/config/widgetConfig';
import { api } from '@/shared/http/client';

import { toEntity } from '../model/entity.mapper';
import type { CreateEntityData, Entity, EntityFilters } from '../model/entity';

import type { ApiEntity } from './entity.dto';
import { mockEntities } from './entity.mock';

const MOCK_DELAY = 500; // ms

/**
 * GET /entities
 */
export async function getEntities(
  filters: EntityFilters = {},
  signal?: AbortSignal,
): Promise<Entity[]> {
  if (USE_MOCKS) {
    await wait(MOCK_DELAY, signal);
    const search = filters.search?.trim().toLowerCase();
    return mockEntities
      .filter((entity) => !search || entity.name.toLowerCase().includes(search))
      .map(toEntity);
  }

  const response = await api.get<ApiEntity[]>('/entities', {
    params: filters.search ? { search: filters.search } : undefined,
    signal,
  });
  return response.data.map(toEntity);
}

/**
 * POST /entities
 */
export async function createEntity(
  data: CreateEntityData,
  signal?: AbortSignal,
): Promise<Entity> {
  if (USE_MOCKS) {
    await wait(MOCK_DELAY, signal);
    const created: ApiEntity = {
      id: `mock-${mockEntities.length + 1}`,
      name: data.name,
      created_at: new Date().toISOString(),
    };
    // Solo en modo mocks: la lista siguiente incluye lo creado.
    mockEntities.push(created);
    return toEntity(created);
  }

  const response = await api.post<ApiEntity>('/entities', data, { signal });
  return toEntity(response.data);
}

/** Espera `ms` o rechaza con el motivo del signal si se cancela antes. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}
