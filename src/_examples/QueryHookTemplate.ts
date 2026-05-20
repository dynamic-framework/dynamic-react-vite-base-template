/**
 * Query Hook Template — Reference Example
 *
 * This file is a reference scaffold. To use:
 *   1. Copy this file to `src/hooks/use<EntityName>.ts`
 *      (convention: camelCase `use` + PascalCase entity,
 *       e.g. `useAccount.ts`, `usePolicy.ts`)
 *   2. Rename `entityKeys`/`useEntities`/etc. to your actual entity
 *   3. Point the repository import at `<entityName>` (not `_template`)
 *
 * These hooks:
 * - Wrap calls to the repository
 * - Manage cache, loading, error states automatically
 * - Support cancellation via AbortSignal
 * - Invalidate cache appropriately on mutations
 *
 * Pattern: one file per entity (useAccount.ts, usePolicy.ts, etc.)
 *
 * The relative imports below already match the destination location
 * (`src/hooks/`), not the current location of this file in
 * `src/_examples/`. After copying, no path adjustments are needed.
 *
 * This file is excluded from TypeScript compilation
 * (see tsconfig.app.json `exclude`).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getEntities,
  getEntityById,
  createEntity,
  updateEntity,
  deleteEntity,
} from '../services/repositories/<entityName>';
import type { CreateEntityData, UpdateEntityData } from '../types';

// ============================================
// QUERY KEYS
// ============================================

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...entityKeys.lists(), filters] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
};

// ============================================
// QUERIES
// ============================================

/**
 * Hook to fetch the entity list.
 */
export function useEntities() {
  return useQuery({
    queryKey: entityKeys.lists(),
    queryFn: ({ signal }) => getEntities(signal),
  });
}

/**
 * Hook to fetch a single entity by ID.
 */
export function useEntity(id: string) {
  return useQuery({
    queryKey: entityKeys.detail(id),
    queryFn: ({ signal }) => getEntityById(id, signal),
    enabled: Boolean(id),
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Hook to create an entity.
 */
export function useCreateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEntityData) => createEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
}

/**
 * Hook to update an entity.
 */
export function useUpdateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEntityData }) => updateEntity(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
}

/**
 * Hook to delete an entity.
 */
export function useDeleteEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEntity(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: entityKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
}
