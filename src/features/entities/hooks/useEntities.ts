/**
 * useEntities — canonical TanStack Query hook example.
 *
 * Wraps the EntityRepository so components get cache + loading/error states for
 * free, and invalidates the list on mutations. One file per entity (useEntities,
 * usePolicies, ...). Copy to `src/hooks/use<EntityName>.ts` and point the
 * repository import at your `<EntityName>Repository`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createEntity, getEntities } from '../services/repositories/EntityRepository';
import type { CreateEntityData } from '../types';

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
};

/**
 * Fetch the entity list.
 */
export function useEntities() {
  return useQuery({
    queryKey: entityKeys.lists(),
    queryFn: ({ signal }) => getEntities(signal),
  });
}

/**
 * Create an entity, invalidating the list on success.
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
