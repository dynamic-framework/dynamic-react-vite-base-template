/**
 * Template para TanStack Query Hooks.
 *
 * Estos hooks:
 * - Encapsulan llamadas a repositorios
 * - Gestionan cache, loading, error states automaticamente
 * - Soportan cancelacion via AbortSignal
 * - Invalidan cache apropiadamente en mutations
 *
 * Patron: un archivo por entidad (useEntities.ts, usePolicies.ts, etc.)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getEntities,
  getEntityById,
  createEntity,
  updateEntity,
  deleteEntity,
} from '../services/repositories/_template';
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
 * Hook para obtener lista de entidades.
 */
export function useEntities() {
  return useQuery({
    queryKey: entityKeys.lists(),
    queryFn: ({ signal }) => getEntities(signal),
  });
}

/**
 * Hook para obtener una entidad por ID.
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
 * Hook para crear una entidad.
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
 * Hook para actualizar una entidad.
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
 * Hook para eliminar una entidad.
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
